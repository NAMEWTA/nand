/**
 * Disk-backed archive index timings. Not a `test:*` script: `test:all` would
 * otherwise pull 5,000 notes into every CI run. A missed record fails the
 * process. Printed latencies are measurements, not pass lines.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContactsIndex, emptyQuery } from '../src/core/contacts/index-store';
import { newRecord } from '../src/core/contacts/model';
import { createMarkdown, parseRecord } from '../src/core/contacts/persist/markdown';

async function main(): Promise<void> {
const counts = [100, 1000, 5000];
const body = `${'甲'.repeat(40)}\n`.repeat(50).slice(0, 2000);
const root = await mkdtemp(join(tmpdir(), 'nand-contacts-scale-'));
const samples: Array<{ count: number; bytes: number; indexMs: number; p95: number }> = [];
try {
	for (const count of counts) {
		const dir = join(root, String(count));
		await mkdir(dir);
		const paths: string[] = [];
		let bytes = 0;
		for (let i = 0; i < count; i++) {
			const record = newRecord('person');
			record.fields.name = `Scale ${i}`;
			// Search is one substring, so `token-42` also matches `token-420`.
			record.prose.notes = i === 42 ? 'nand-scale-needle' : `token-${i}`;
			record.path = join(dir, `${i}.md`);
			const markdown = `${createMarkdown(record)}\n\n${body}\n`;
			await writeFile(record.path, markdown);
			bytes += Buffer.byteLength(markdown);
			paths.push(record.path);
		}
		const index = new ContactsIndex();
		const started = performance.now();
		for (const path of paths) {
			const record = parseRecord(await readFile(path, 'utf8'), path);
			if (!record) throw new Error(`Unparsed ${path}`);
			index.set(record);
		}
		const indexMs = Math.round(performance.now() - started);
		await rm(dir, { recursive: true, force: true });
		const timings: number[] = [];
		for (let n = 0; n < 20; n++) {
			const at = performance.now();
			const found = index.query({ ...emptyQuery(), search: 'nand-scale-needle' });
			timings.push(performance.now() - at);
			if (found.length !== 1) throw new Error(`Expected one hit for ${count}, got ${found.length}`);
		}
		timings.sort((a, b) => a - b);
		samples.push({
			count,
			bytes,
			indexMs,
			p95: Math.round((timings[Math.ceil(timings.length * 0.95) - 1] ?? 0) * 100) / 100,
		});
		index.clear();
	}
} finally {
	await rm(root, { recursive: true, force: true });
}
console.log(JSON.stringify({ samples, note: 'Files were removed before the timed queries. P95 is a measurement, not a pass line.' }));
}
main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
