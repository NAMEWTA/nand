import type { App } from 'obsidian';
import { JsonStore } from '../../../shared/json-store';
import { isContentPath } from '../../../shared/storage/content-paths';
import { validateNandPath } from '../../../shared/storage/nand-paths';
import { privateVaultStorage } from './private-storage';

interface Move { from: string; to: string; origin: string }
interface Moves { version: 1; entries: Move[] }
function valid(value: unknown): value is Moves {
	if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('entries' in value) || !Array.isArray(value.entries)) return false;
	return value.entries.every((entry: unknown) => {
		if (!entry || typeof entry !== 'object') return false;
		try { return ['from', 'to', 'origin'].every(key => { const path = (entry as Record<string, unknown>)[key]; return typeof path === 'string' && isContentPath(path) && validateNandPath(path) === path; }); } catch { return false; }
	});
}

/** A pre-move receipt preserves incoming links and the original relative-link context. */
export class ContentMoves {
	private value: Moves = { version: 1, entries: [] };
	private store: JsonStore<Moves>;
	constructor(app: App) { this.store = new JsonStore(privateVaultStorage(app), '.nand/content-moves/manifest.json', valid); }
	async load(): Promise<void> { this.value = await this.store.load({ version: 1, entries: [] }); }
	origin(path: string): string { return this.value.entries.findLast(entry => entry.to === path)?.origin ?? path; }
	async prepare(from: string, to: string): Promise<void> {
		await this.load();
		const entry = { from, to, origin: this.origin(from) };
		this.value = await this.store.commit({ base: this.value, value: { version: 1, entries: [...this.value.entries, entry] } });
	}
	target(path: string, exists: (path: string) => boolean): string | null {
		const seen = new Set<string>(); let current = path;
		while (!seen.has(current)) {
			if (exists(current)) return current;
			seen.add(current);
			const move = this.value.entries.findLast(entry => entry.from === current);
			if (!move) return null;
			current = move.to;
		}
		return null;
	}
}
