// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { TFile, type App } from 'obsidian';
import { cleanTag, hashText, mapTagList, rewriteTagsAt, type TagMapper, type TagPosition } from '../core/tag-edit';
import { plainEqual } from '../core/plain-yaml';
import { readProperties, splitNote } from './frontmatter';

const TAG_KEYS = ['tags', 'tag'] as const;
type TagKey = (typeof TAG_KEYS)[number];
/** A property as it stood: whether the key exists at all (a key may exist with a null value) and its value. */
interface PropertyState { present: boolean; value?: unknown }
type TagProperties = Partial<Record<TagKey, PropertyState>>;

/**
 * What one tag edit did to one note, kept so it can be undone without touching anything else. The text after the
 * frontmatter and the tag properties are recorded separately, each captured inside the same atomic write that
 * changed it, so an independent edit can never end up in a restore point.
 */
export interface TagEditRecord {
	path: string;
	/** The text after the frontmatter: before the edit, and a hash of what the edit left. */
	body?: { before: string; afterHash: string };
	/** The `tags` / `tag` properties before and after, each with whether the key existed and its exact value. */
	frontmatter?: { before: TagProperties; after: TagProperties };
}

export interface TagEditResult {
	/** Every note that changed, including one that was only partly written when something failed. */
	records: TagEditRecord[];
	/** The note the edit stopped at and why; the notes after it were not touched. */
	failed?: { path: string; error: unknown };
	/** Notes left alone because their properties cannot be handled safely (invalid YAML, or values of a type this plugin does not know); nothing in them was changed. */
	unreadable: string[];
	/** Notes left alone because Obsidian's tag positions did not match the file (the metadata is behind); nothing in them was changed. */
	skipped: string[];
}

export interface TagEditOptions {
	shouldStop?: () => boolean;
	/** Wait for the metadata cache to catch up; the default waits 200 ms. */
	wait?: (ms: number) => Promise<void>;
	/** How many times a stale note is retried before it is skipped. */
	retries?: number;
}

const hasOwn = (target: object, key: string) => Object.prototype.hasOwnProperty.call(target, key);
const stateOf = (frontmatter: Record<string, unknown>, key: string): PropertyState => (hasOwn(frontmatter, key) ? { present: true, value: structuredClone(frontmatter[key]) } : { present: false });
/** Missing, null, an empty string and an empty list are all different states. */
const sameState = (a: PropertyState, b: PropertyState) => a.present === b.present && (!a.present || plainEqual(a.value, b.value));

function frontmatterTagList(value: unknown): string[] | undefined {
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === 'string') return value.split(/[,\s]+/).filter(Boolean);
	return undefined;
}

interface CachedTags { tag: string; position: { start: { offset: number }; end: { offset: number } } }

/** The inline tags Obsidian found in the note, as positions; undefined when the cache is known to be older than the file. */
function cachedTagPositions(app: App, file: TFile): TagPosition[] | undefined {
	const entry = (app.metadataCache as unknown as { fileCache?: Record<string, { mtime?: number; size?: number } | undefined> }).fileCache?.[file.path];
	// When the host exposes when the cache was made, it must be the file's current state.
	if (entry && typeof entry.mtime === 'number' && file.stat && (entry.mtime !== file.stat.mtime || (typeof entry.size === 'number' && entry.size !== file.stat.size))) return undefined;
	const tags = (app.metadataCache.getFileCache(file)?.tags ?? []) as CachedTags[];
	return tags.map((item) => ({ tag: item.tag, start: item.position.start.offset, end: item.position.end.offset }));
}

/** Change the inline tags of one note in a single atomic write, at the positions Obsidian reports. */
async function editBody(app: App, file: TFile, mapper: TagMapper): Promise<{ status: 'stale' } | { status: 'done'; record?: NonNullable<TagEditRecord['body']> }> {
	let result: { status: 'stale' } | { status: 'done'; record?: NonNullable<TagEditRecord['body']> } = { status: 'done' };
	await app.vault.process(file, (data) => {
		const positions = cachedTagPositions(app, file);
		const rewrite = positions ? rewriteTagsAt(data, positions, mapper) : undefined;
		if (!rewrite || rewrite.stale) { result = { status: 'stale' }; return data; }
		if (!rewrite.changed) return data;
		result = { status: 'done', record: { before: splitNote(data).body, afterHash: hashText(splitNote(rewrite.text).body) } };
		return rewrite.text;
	});
	return result;
}

/** Change the `tags` / `tag` properties through Obsidian's own frontmatter writer; returns the before/after values when something changed. */
async function editProperties(app: App, file: TFile, mapper: TagMapper): Promise<NonNullable<TagEditRecord['frontmatter']> | undefined> {
	let record: NonNullable<TagEditRecord['frontmatter']> | undefined;
	// Only Obsidian's own reading of the frontmatter decides whether the note has tag properties (any spelling of the key).
	const found = readProperties(await app.vault.read(file));
	if (!found || !TAG_KEYS.some((key) => hasOwn(found, key))) return undefined;
	await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
		const before: TagProperties = {};
		const after: TagProperties = {};
		for (const key of TAG_KEYS) {
			if (!hasOwn(frontmatter, key)) continue;
			const list = frontmatterTagList(frontmatter[key]);
			if (!list) continue;
			const mapped = mapTagList(list, mapper);
			if (mapped.length === list.length && mapped.every((tag, index) => tag === cleanTag(list[index]!))) continue;
			before[key] = stateOf(frontmatter, key);
			if (mapped.length) frontmatter[key] = mapped; else delete frontmatter[key];
			after[key] = stateOf(frontmatter, key);
		}
		if (Object.keys(before).length) record = { before, after };
	});
	return record;
}

/**
 * Apply a tag mapping to the inline tags (at Obsidian's reported positions) and the frontmatter tags of notes.
 * Records are collected note by note and returned even when a write fails, so whatever was written can be undone.
 */
export async function editTags(app: App, files: readonly TFile[], mapper: TagMapper, options: TagEditOptions = {}): Promise<TagEditResult> {
	const records: TagEditRecord[] = [];
	const skipped: string[] = [];
	const unreadable: string[] = [];
	const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); }));
	for (const file of files) {
		if (file.extension !== 'md') continue;
		if (options.shouldStop?.()) break;
		const record: TagEditRecord = { path: file.path };
		try {
			// A note whose properties cannot be read back safely is not touched at all, inline tags included.
			if (!readProperties(await app.vault.read(file))) { unreadable.push(file.path); continue; }
			let body = await editBody(app, file, mapper);
			for (let attempt = 0; body.status === 'stale' && attempt < (options.retries ?? 8); attempt++) {
				await wait(200);
				body = await editBody(app, file, mapper);
			}
			if (body.status === 'stale') { skipped.push(file.path); continue; }
			if (body.record) { record.body = body.record; records.push(record); }
			const frontmatter = await editProperties(app, file, mapper);
			if (frontmatter) {
				record.frontmatter = frontmatter;
				if (!records.includes(record)) records.push(record);
			}
		} catch (error) {
			return { records, failed: { path: file.path, error }, skipped, unreadable };
		}
	}
	return { records, skipped, unreadable };
}

export interface UndoResult {
	/** Notes where at least one part was put back. */
	restored: number;
	/** Notes with a part left alone because it had been changed since; their paths. */
	skipped: string[];
	/** Parts that could not be written; the undo can be tried again with these. */
	remaining: TagEditRecord[];
}

/**
 * Put edits back. Each part is restored only while it is still exactly what the edit left (the text after the
 * frontmatter by hash, the tag properties by value), and anything changed since is left alone and reported.
 */
export async function undoTagEdit(app: App, records: readonly TagEditRecord[]): Promise<UndoResult> {
	let restored = 0;
	const skipped: string[] = [];
	const remaining: TagEditRecord[] = [];
	for (const record of records) {
		const file = app.vault.getFileByPath(record.path);
		if (!file) { skipped.push(record.path); continue; }
		const left: TagEditRecord = { path: record.path };
		let did = false;
		let skip = false;
		if (record.body) {
			const { before, afterHash } = record.body;
			try {
				let done = false;
				await app.vault.process(file, (data) => {
					const { head, body } = splitNote(data);
					if (hashText(body) !== afterHash) return data;
					done = true;
					return head + before;
				});
				if (done) did = true; else skip = true;
			} catch {
				left.body = record.body;
			}
		}
		if (record.frontmatter) {
			const { before, after } = record.frontmatter;
			try {
				let done = false;
				await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
					const keys = Object.keys(before) as TagKey[];
					// Only while every property is still exactly what the edit left (a missing key is not the same as null).
					if (!keys.every((key) => sameState(stateOf(frontmatter, key), after[key] ?? { present: false }))) return;
					for (const key of keys) {
						const wanted = before[key]!;
						if (wanted.present) frontmatter[key] = wanted.value; else delete frontmatter[key];
					}
					done = true;
				});
				if (done) did = true; else skip = true;
			} catch {
				left.frontmatter = record.frontmatter;
			}
		}
		if (did) restored++;
		if (skip) skipped.push(record.path);
		if (left.body || left.frontmatter) remaining.push(left);
	}
	return { restored, skipped, remaining };
}

/** Remove every tag (frontmatter and inline) from notes. */
export const clearTags = (app: App, files: readonly TFile[], options?: TagEditOptions): Promise<TagEditResult> => editTags(app, files, () => null, options);
