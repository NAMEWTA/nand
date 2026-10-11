import type { App } from 'obsidian';
import { JsonStore } from '../../../shared/json-store';
import { isContentPath } from '../../../shared/storage/content-paths';
import { validateNandPath } from '../../../shared/storage/nand-paths';
import { privateVaultStorage } from './private-storage';
import { contentDigest, copyContentExclusive } from './content-io';

interface Move { from: string; to: string }
export interface LinkEdit { path: string; before: string; after: string }
interface Pending extends Move { edits: LinkEdit[]; retained: string; digest: string }
interface Moves { version: 1; entries: Move[]; pending?: Pending }
function valid(value: unknown): value is Moves {
	if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('entries' in value) || !Array.isArray(value.entries)) return false;
	const validPath = (path: unknown, managed = true) => { try { return typeof path === 'string' && (!managed || isContentPath(path)) && validateNandPath(isContentPath(path) ? path : '.nand/' + path).length > 0; } catch { return false; } };
	const move = (entry: unknown) => !!entry && typeof entry === 'object' && 'from' in entry && 'to' in entry && validPath(entry.from) && validPath(entry.to);
	if (!value.entries.every(move)) return false;
	if (!('pending' in value) || value.pending === undefined) return true;
	const pending = value.pending;
	return move(pending) && !!pending && typeof pending === 'object' && 'retained' in pending && typeof pending.retained === 'string' && pending.retained.startsWith('.nand/recovery/renames/') && validPath(pending.retained, false) && 'digest' in pending && typeof pending.digest === 'string' && /^[a-f\d]{64}$/.test(pending.digest) && 'edits' in pending && Array.isArray(pending.edits) && pending.edits.every((edit: unknown) => !!edit && typeof edit === 'object' && 'path' in edit && validPath(edit.path, false) && 'before' in edit && typeof edit.before === 'string' && 'after' in edit && typeof edit.after === 'string');
}

/** The receipt makes link edits reversible until the physical move has happened. */
export class ContentMoves {
	private value: Moves = { version: 1, entries: [] };
	private store: JsonStore<Moves>;
	constructor(private readonly app: App) { this.store = new JsonStore(privateVaultStorage(app), '.nand/content-moves/manifest.json', valid); }
	async load(): Promise<void> { this.value = await this.store.load({ version: 1, entries: [] }); }
	private async save(value: Moves): Promise<void> { this.value = await this.store.commit({ base: this.value, value }); }
	async prepare(from: string, to: string, edits: LinkEdit[], retained: string, digest: string): Promise<void> {
		if (this.value.pending) throw new Error('nand-content.move-pending');
		await this.save({ ...this.value, pending: { from, to, edits, retained, digest } });
	}
	async finish(): Promise<void> {
		const pending = this.value.pending;
		if (!pending) return;
		const { from, to } = pending;
		const entries = this.value.entries.filter(entry => entry.from !== from).map(entry => entry.to === from ? { ...entry, to } : entry);
		await this.save({ version: 1, entries: [...entries, { from, to }] });
	}
	async created(path: string): Promise<void> {
		const entries = this.value.entries.filter(entry => entry.to !== path && entry.from !== path);
		if (entries.length !== this.value.entries.length) await this.save({ ...this.value, entries });
	}
	async apply(edit: LinkEdit, forward: boolean, check: (path: string, text: string) => void, path = edit.path): Promise<void> {
		const expected = forward ? edit.before : edit.after, wanted = forward ? edit.after : edit.before;
		const update = (current: string) => {
			if (current === wanted) return current;
			if (current !== expected) throw new Error(`nand-content.move-conflict: ${path}`);
			check(edit.path, edit.before); return wanted;
		};
		if (isContentPath(path)) {
			if (!await privateVaultStorage(this.app).exists(path)) throw new Error(`nand-content.move-missing: ${path}`);
			await this.app.vault.adapter.process(path, update);
		} else {
			const file = this.app.vault.getFileByPath(path);
			if (!file) throw new Error(`nand-content.move-missing: ${path}`);
			await this.app.vault.process(file, update);
		}
	}
	async recover(check: (path: string, text: string) => void): Promise<void> {
		const pending = this.value.pending;
		if (!pending) return;
		const storage = privateVaultStorage(this.app), moved = await storage.exists(pending.retained);
		if (!moved && !await storage.exists(pending.from)) throw new Error('nand-content.move-missing');
		for (const edit of pending.edits) await this.apply(edit, moved, check, moved && edit.path === pending.from ? pending.retained : edit.path);
		if (moved) { await this.publish(); await this.finish(); } else await this.save({ version: 1, entries: this.value.entries });
	}
	async publish(): Promise<void> {
		const pending = this.value.pending;
		if (!pending) throw new Error('nand-content.move-missing');
		if (await contentDigest(this.app, pending.retained) !== pending.digest) throw new Error('nand-content.move-source-changed');
		if (!await privateVaultStorage(this.app).exists(pending.to)) await copyContentExclusive(this.app, pending.retained, pending.to);
		if (await contentDigest(this.app, pending.to) !== pending.digest) throw new Error('nand-content.move-target-changed');
	}
	target(path: string, exists: (path: string) => boolean): string | null {
		const target = this.value.entries.findLast(entry => entry.from === path)?.to;
		return target && exists(target) ? target : null;
	}
}
