import { stringify, parse as parseYaml } from 'yaml';
import { patchFrontmatter, readMarkdownDocument, readYaml } from './markdown-document';
import { threeWayMerge } from './three-way-merge';

export interface DocumentValue {
	properties: Record<string, unknown>;
	rows?: Array<Record<string, unknown>>;
	sections?: Record<string, string>;
}
export interface DocumentSnapshot {
	path: string;
	text: string;
	value: DocumentValue;
}
export interface DocumentPort {
	read(path: string): Promise<string>;
	/** Must protect an open editor's unsaved text and process the latest contents atomically. */
	process(path: string, update: (text: string | null) => string): Promise<string>;
}
const start = '<!-- nand:records -->',
	end = '<!-- /nand:records -->';
const encode = (value: unknown): string => JSON.stringify(value ?? null).replace(/\|/g, '\\u007c');

export function parseDocumentValue(text: string): DocumentValue {
	const { yaml, body } = readMarkdownDocument(text);
	const properties = readYaml(yaml).toJSON() as Record<string, unknown>;
	const sections: Record<string, string> = {};
	const markers = [...body.matchAll(/<!-- (\/?nand:)([a-z-]+) -->/g)];
	for (let i = 0; i < markers.length; i += 2) {
		const opening = markers[i]!,
			closing = markers[i + 1];
		if (
			opening[1] !== 'nand:' ||
			closing?.[1] !== '/nand:' ||
			opening[2] !== closing[2] ||
			markers.slice(0, i).some((marker) => marker[2] === opening[2])
		)
			throw new Error('Invalid NAND section markers');
	}
	for (const match of body.matchAll(/<!-- nand:([a-z-]+) -->\r?\n([\s\S]*?)<!-- \/nand:\1 -->/g)) {
		if (match[1] !== 'records') sections[match[1]!] = match[2]!.replace(/\r?\n$/, '');
	}
	const extra = Object.keys(sections).length ? { sections } : {};
	const a = body.indexOf(start),
		b = body.indexOf(end);
	if (a < 0 && b < 0) return { properties, ...extra };
	if (a < 0 || b < a || body.indexOf(start, a + start.length) >= 0) throw new Error('Invalid NAND record region');
	const lines = body
		.slice(a + start.length, b)
		.trim()
		.split(/\r?\n/);
	if (lines.length < 2) throw new Error('Invalid NAND record table');
	const cells = (line: string) =>
		line
			.trim()
			.replace(/^\||\|$/g, '')
			.split('|')
			.map((v) => v.trim());
	const keys = cells(lines[0]!);
	if (
		!keys.includes('id') ||
		new Set(keys).size !== keys.length ||
		!cells(lines[1]!).every((cell) => /^:?-+:?$/.test(cell))
	)
		throw new Error('Invalid NAND record header');
	const rows = lines
		.slice(2)
		.filter((line) => line.trim())
		.map((line) => {
			const values = cells(line);
			if (values.length !== keys.length) throw new Error('Invalid NAND record row');
			return Object.fromEntries(keys.map((key, i) => [key, parseYaml(values[i]!) as unknown]));
		});
	const ids = rows.map((row) => row.id);
	if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length)
		throw new Error('Missing or duplicate record id');
	return { properties, rows, ...extra };
}

function render(value: DocumentValue): string {
	let text = `---\n${stringify(value.properties)}---\n`;
	for (const [name, content] of Object.entries(value.sections ?? {})) {
		if (!/^[a-z-]+$/.test(name) || name === 'records' || /<!-- \/?nand:[a-z-]+ -->/.test(content))
			throw new Error('Reserved NAND section marker');
		text += `\n<!-- nand:${name} -->\n${content}\n<!-- /nand:${name} -->\n`;
	}
	if (value.rows) {
		const keys = [...new Set(['id', ...value.rows.flatMap((row) => Object.keys(row))])];
		text += `\n${start}\n| ${keys.join(' | ')} |\n| ${keys.map(() => '---').join(' | ')} |\n`;
		text += value.rows.map((row) => `| ${keys.map((key) => encode(row[key])).join(' | ')} |\n`).join('');
		text += `${end}\n`;
	}
	return text;
}

/** User-owned frontmatter/body are preserved; only the caller's projection is updated. */
export class DocumentRepository {
	constructor(private port: DocumentPort) {}
	async read(path: string): Promise<DocumentSnapshot> {
		const text = await this.port.read(path);
		return { path, text, value: parseDocumentValue(text) };
	}
	async update(path: string, baseline: DocumentValue, next: DocumentValue): Promise<DocumentSnapshot> {
		const text = await this.port.process(path, (current) => {
			if (current === null) {
				if (Object.keys(baseline.properties).length) throw new Error(`Document removed: ${path}`);
				return render(next);
			}
			const remote = parseDocumentValue(current);
			const value = threeWayMerge(baseline, next, remote);
			const original = readMarkdownDocument(current);
			const generated = render(value);
			let body = original.body;
			for (const name of new Set([...Object.keys(remote.sections ?? {}), ...Object.keys(value.sections ?? {})])) {
				if (remote.sections?.[name] === value.sections?.[name]) continue;
				const opening = `<!-- nand:${name} -->`,
					closing = `<!-- /nand:${name} -->`;
				const a = body.indexOf(opening),
					b = body.indexOf(closing);
				const section =
					value.sections?.[name] === undefined ? '' : `${opening}\n${value.sections[name]}\n${closing}`;
				body = a >= 0 ? body.slice(0, a) + section + body.slice(b + closing.length) : body + `\n${section}\n`;
			}
			if (JSON.stringify(remote.rows) !== JSON.stringify(value.rows)) {
				const generatedBody = readMarkdownDocument(generated).body;
				const region = value.rows
					? generatedBody.slice(generatedBody.indexOf(start), generatedBody.indexOf(end) + end.length)
					: '';
				const a = body.indexOf(start),
					b = body.indexOf(end);
				body = a >= 0 ? body.slice(0, a) + region + body.slice(b + end.length) : body + `\n${region}\n`;
			}
			const front = generated.slice(0, generated.length - readMarkdownDocument(generated).body.length);
			return patchFrontmatter(current, render(remote), front + body);
		});
		return { path, text, value: parseDocumentValue(text) };
	}
}
