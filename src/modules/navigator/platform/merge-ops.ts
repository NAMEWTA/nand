// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { TFile, normalizePath, type App } from 'obsidian';
import { mergedName, mergeNotes, mergeProperties } from '../core/merge';
import { plainEqual } from '../core/plain-yaml';
import { uniquePath } from '../core/ops';
import { hashText } from '../core/tag-edit';
import { parentFolder } from '../core/types';
import { readProperties, splitNote, type Properties } from './frontmatter';

/** Markdown notes among `files` in the given order. */
export const mergeable = (files: readonly (TFile | null)[]): TFile[] => files.filter((file): file is TFile => file instanceof TFile && file.extension === 'md');

interface Snapshot {
	contents: string[];
	properties: Properties[];
	/** One hash per note: what the merge was computed from. */
	fingerprint: string[];
}

/** Read every note's current text and properties together; undefined when a note's frontmatter is not valid YAML. */
async function snapshot(app: App, files: readonly TFile[]): Promise<Snapshot | { unreadable: string }> {
	const contents: string[] = [];
	const properties: Properties[] = [];
	for (const file of files) {
		const content = await app.vault.read(file);
		const found = readProperties(content);
		if (!found) return { unreadable: file.path };
		contents.push(content);
		properties.push(found);
	}
	return { contents, properties, fingerprint: contents.map(hashText) };
}

export interface MergePlan {
	/** Properties other notes have with a different value; they are not carried over. */
	conflicts: string[];
	/** What the plan was made from; `mergeFiles` refuses to go on if the notes changed since. */
	fingerprint: string[];
}

/** What a merge would keep, from the notes as they are now; `unreadable` names a note whose properties cannot be handled safely. */
export async function planMerge(app: App, files: readonly TFile[]): Promise<MergePlan | { unreadable: string }> {
	const current = await snapshot(app, files);
	return 'unreadable' in current ? current : { conflicts: mergeProperties(current.properties).conflicts, fingerprint: current.fingerprint };
}

export type MergeOutcome =
	| { status: 'merged'; file: TFile; originalsKept: boolean }
	| { status: 'changed' }
	| { status: 'unreadable'; path: string }
	/** The written result did not read back as planned: the result stays at `path` for the user to check and the originals were kept. */
	| { status: 'lossy'; path: string };

/**
 * Create one note from several, next to the first, keeping the first note's properties. Text and properties are read
 * again when this runs: if any note differs from what `expected` was planned on, nothing is written. Originals are
 * trashed (following Obsidian's deletion setting) only after the merged note, properties included, has been written
 * and only if none of them changed in the meantime.
 */
export async function mergeFiles(app: App, files: readonly TFile[], options: { suffix: string; deleteOriginals: boolean; expected?: readonly string[] }): Promise<MergeOutcome> {
	const first = files[0];
	if (!first) throw new Error('nothing to merge');
	const current = await snapshot(app, files);
	if ('unreadable' in current) return { status: 'unreadable', path: current.unreadable };
	if (options.expected && (options.expected.length !== current.fingerprint.length || options.expected.some((hash, index) => hash !== current.fingerprint[index]))) return { status: 'changed' };
	const { properties } = mergeProperties(current.properties);
	const inputs = files.map((file, index) => ({ name: file.basename, body: splitNote(current.contents[index]!).body }));
	const folder = parentFolder(first.path);
	const taken = (name: string) => app.vault.getAbstractFileByPath(normalizePath(uniquePath(folder, name, 'md', () => false))) !== null;
	const name = mergedName(first.basename, options.suffix, taken);
	const merged = await app.vault.create(normalizePath(uniquePath(folder, name, 'md', () => false)), mergeNotes(inputs));
	if (Object.keys(properties).length) {
		await app.fileManager.processFrontMatter(merged, (frontmatter: Properties) => {
			// defineProperty, not assignment: a `__proto__` key must stay a property.
			for (const [key, value] of Object.entries(properties)) Object.defineProperty(frontmatter, key, { value, enumerable: true, writable: true, configurable: true });
		});
	}
	// Proof after writing: what is on disk must read back, through Obsidian, as exactly the planned properties and body.
	// A value the host writes in another form (a date that comes back as text, for instance) is a loss, so the
	// originals stay.
	const written = await app.vault.read(merged);
	const reread = readProperties(written);
	const body = mergeNotes(inputs);
	const proven = reread !== undefined && plainEqual(reread, properties) && splitNote(written).body.replace(/^\n+/, '') === body.replace(/^\n+/, '');
	// The result is never deleted automatically: it may already hold someone's edit. It stays for the user to check.
	if (!proven) return { status: 'lossy', path: merged.path };
	if (!options.deleteOriginals) return { status: 'merged', file: merged, originalsKept: false };
	// Notes edited while the merged note was being made would lose that edit in the trash: keep them all.
	for (const [index, file] of files.entries()) {
		const now = await app.vault.read(file).catch(() => undefined);
		if (now === undefined || hashText(now) !== current.fingerprint[index]) return { status: 'merged', file: merged, originalsKept: true };
	}
	for (const file of files) await app.fileManager.trashFile(file);
	return { status: 'merged', file: merged, originalsKept: false };
}
