import type { App, TAbstractFile } from 'obsidian';
import type { WidgetSettingsHost } from '../widget-settings-host';

import { MEDIA_TAG_MAX_PER_FILE, normalizeTags, sanitizeMediaTags } from '../../core/media/tags';
export { MEDIA_TAG_MAX_LEN, MEDIA_TAG_MAX_PER_FILE, normalizeTags, sanitizeMediaTags } from '../../core/media/tags';

/** Plugin-scoped service instance, registered from main.ts onload so the
 *  renderer (which only receives App) can reach it. Cleared on unload. */
/**
 * Owns the media tag store (settings.mediaTags: Record<path, string[]>).
 * Writes go through a 400ms debounce so batch tagging produces a single
 * settings write; vault rename/delete events keep the path keys in sync.
 */
export class MediaTagService {
	private plugin: WidgetSettingsHost;
	private data: Record<string, string[]> = {};
	private saveTimer: number | null = null;
	private readonly debounceMs = 400;
	private renameRef: ReturnType<App['vault']['on']> | null = null;
	private deleteRef: ReturnType<App['vault']['on']> | null = null;

	constructor(plugin: WidgetSettingsHost) {
		this.plugin = plugin;
		this.registerVaultEvents(plugin.app);
	}

	/** Read the (already sanitized) tags from plugin settings. */
	load(): void {
		this.data = sanitizeMediaTags(this.plugin.settings.mediaTags);
		this.plugin.settings.mediaTags = this.data;
	}

	/** Flush any pending write and detach vault listeners. */
	destroy(): void {
		void this.flush();
		if (this.renameRef !== null) this.plugin.app.vault.offref(this.renameRef);
		if (this.deleteRef !== null) this.plugin.app.vault.offref(this.deleteRef);
		this.renameRef = null;
		this.deleteRef = null;
	}

	getTags(path: string): string[] {
		return this.data[path] ?? [];
	}

	/** Union of all tags in use across media files, sorted and deduped. */
	getAllTags(): string[] {
		const seen = new Set<string>();
		for (const tags of Object.values(this.data)) {
			for (const tag of tags) seen.add(tag);
		}
		return [...seen].sort((a, b) => a.localeCompare(b));
	}

	/** Set the tag list for one file. Returns true when anything changed. */
	setTags(path: string, tags: readonly string[]): boolean {
		const next = normalizeTags(tags).slice(0, MEDIA_TAG_MAX_PER_FILE);
		const prev = this.data[path];
		const same = prev !== undefined && prev.length === next.length && prev.every((t, i) => t === next[i]);
		if (same) return false;
		if (next.length === 0) delete this.data[path];
		else this.data[path] = next;
		this.plugin.settings.mediaTags = this.data;
		this.scheduleSave();
		return true;
	}

	/** Debounced persist: consecutive tag edits within the window coalesce
	 *  into one settings write. */
	private scheduleSave(): void {
		if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(() => {
			this.saveTimer = null;
			void this.plugin.saveSettings();
		}, this.debounceMs);
	}

	/** Persist immediately (used on unload). */
	async flush(): Promise<void> {
		if (this.saveTimer !== null) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
			await this.plugin.saveSettings();
		}
	}

	/** Re-key on rename/move, prune on delete, debounced save. */
	private registerVaultEvents(app: App): void {
		this.renameRef = app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
			const tags = this.data[oldPath];
			if (!tags) return;
			delete this.data[oldPath];
			this.data[file.path] = tags;
			this.plugin.settings.mediaTags = this.data;
			this.scheduleSave();
		});
		this.deleteRef = app.vault.on('delete', (file: TAbstractFile) => {
			if (!this.data[file.path]) return;
			delete this.data[file.path];
			this.plugin.settings.mediaTags = this.data;
			this.scheduleSave();
		});
	}
}
