import {
	Notice,
	normalizePath,
	type App,
	type Component,
	type EventRef,
	type PluginManifest,
	type Vault,
} from 'obsidian';
import { getLanguage } from '../../shared/i18n';
import { DEFAULT_ICONIC_SETTINGS, type IconicSettings } from '../settings/model';
import { STRINGS } from '../i18n';
const HOUR = 3600000;
const MINUTE = 60000;
const SECOND = 1000;
export class IconicStore {
	settings = structuredClone(DEFAULT_ICONIC_SETTINGS);
	readonly path: string;
	private isSaving = false;
	private pending: Promise<void> = Promise.resolve();
	private reloadPending: Promise<void> = Promise.resolve();
	private lastText: string | null = null;
	private watching = false;
	private watchGeneration = 0;
	private reloading = false;

	constructor(
		private readonly app: App,
		manifest: Pick<PluginManifest, 'id'>,
	) {
		this.path = normalizePath(`${app.vault.configDir}/plugins/${manifest.id}/iconic.json`);
	}

	save(): Promise<void> {
		if (this.isSaving) return this.pending;
		this.pending = this.persist().finally(() => {
			this.isSaving = false;
		});
		return this.pending;
	}
	async flush(): Promise<void> {
		await this.pending;
		await this.reloadPending;
	}

	private async loadData(): Promise<unknown> {
		if (!(await this.app.vault.adapter.exists(this.path))) {
			this.lastText = null;
			return null;
		}
		const text = await this.app.vault.adapter.read(this.path);
		const value: unknown = JSON.parse(text);
		this.lastText = text;
		return value;
	}
	private async saveData(settings: IconicSettings): Promise<void> {
		const text = JSON.stringify(settings, null, 2);
		await this.app.vault.adapter.write(this.path, text);
		this.lastText = text;
	}

	/** The config directory is not reported by vault create/modify events. */
	watch(scope: Component, onChange: () => void): void {
		this.watching = true;
		const generation = ++this.watchGeneration;
		const doc = this.app.workspace.containerEl.ownerDocument;
		const win = doc.defaultView ?? window;
		let timer: number | undefined;
		const schedule = () => {
			if (!this.watching || generation !== this.watchGeneration) return;
			if (timer !== undefined) win.clearTimeout(timer);
			timer = win.setTimeout(() => {
				timer = undefined;
				this.reloadPending = this.reloadPending
					.then(() => this.reloadExternal(generation, onChange))
					.catch((error: unknown) => {
						console.error('NAND icons: external reload failed', error);
					});
			}, 300);
		};
		const vault = this.app.vault as Vault & { on(name: 'raw', callback: (path: string) => void): EventRef };
		scope.registerEvent(
			vault.on('raw', (path) => {
				if (normalizePath(path) === this.path) schedule();
			}),
		);
		scope.registerDomEvent(doc, 'visibilitychange', () => {
			if (doc.visibilityState === 'visible') schedule();
		});
		scope.registerDomEvent(win, 'focus', schedule);
		scope.registerEvent(
			this.app.workspace.on('window-open', (_workspaceWindow, popout) => {
				scope.registerDomEvent(popout, 'focus', schedule);
			}),
		);
		scope.register(() => {
			this.watching = false;
			++this.watchGeneration;
			if (timer !== undefined) win.clearTimeout(timer);
		});
	}

	private async reloadExternal(generation: number, onChange: () => void): Promise<void> {
		if (!this.watching || generation !== this.watchGeneration || this.reloading) return;
		this.reloading = true;
		try {
			await this.pending;
			if (!this.watching || generation !== this.watchGeneration) return;
			const text = (await this.app.vault.adapter.exists(this.path))
				? await this.app.vault.adapter.read(this.path)
				: null;
			if (text === this.lastText) return;
			if (!this.watching || generation !== this.watchGeneration) return;
			await this.load();
			if (this.watching && generation === this.watchGeneration) onChange();
		} finally {
			this.reloading = false;
		}
	}
	async load(): Promise<void> {
		const { adapter } = this.app.vault;
		const dataPath = this.path;
		const backupPath = normalizePath(dataPath + '.backup');

		// If a backup exists, check `iconic.json` for corruption
		if (await adapter.exists(backupPath + 1)) {
			let dataObject: unknown = {};

			// Try to read `iconic.json`
			if (await adapter.exists(dataPath)) {
				const dataJson = await adapter.read(dataPath);
				try {
					dataObject = JSON.parse(dataJson);
				} catch {
					/* Ignore */
				}
			}

			// If `iconic.json` is missing or corrupted, restore the backup
			if (!dataObject || typeof dataObject !== 'object' || Object.keys(dataObject).length === 0) {
				await this.restoreBackup();
			}
		}

		// Load `iconic.json`
		this.settings = Object.assign({}, structuredClone(DEFAULT_ICONIC_SETTINGS), await this.loadData());
	}

	/**
	 * Restore backup settings from storage.
	 */
	private async restoreBackup(): Promise<void> {
		const { adapter } = this.app.vault;
		const dataPath = this.path;
		const backupPath = normalizePath(dataPath + '.backup');
		const backupStat = await adapter.stat(backupPath + 1);
		if (!backupStat) return;

		// Overwrite `iconic.json` with the backup
		if (await adapter.exists(dataPath)) {
			await adapter.remove(dataPath);
		}
		await adapter.copy(backupPath + 1, dataPath);

		// Describe how long ago the backup was made
		const ago = Date.now() - backupStat.mtime;
		let message = STRINGS.backups.backupNotice + '\n\n';
		if (ago < 60 * SECOND) {
			message += STRINGS.backups.backupSecondsAgo.replace('{#}', Math.round(ago / SECOND).toString());
		} else if (ago < 60 * MINUTE) {
			message += STRINGS.backups.backupMinutesAgo.replace('{#}', Math.round(ago / MINUTE).toString());
		} else if (ago < 24 * HOUR) {
			message += STRINGS.backups.backupHoursAgo.replace('{#}', Math.round(ago / HOUR).toString());
		} else {
			const dateFormat = new Intl.DateTimeFormat(getLanguage(), {
				dateStyle: 'long',
				timeStyle: 'short',
			}).format(backupStat?.mtime);
			message += STRINGS.backups.backupDate.replace('{#}', dateFormat);
		}

		// Notify user about the restored data
		new Notice(message, 0);
	}

	/**
	 * Save settings to storage.
	 */
	private async persist(): Promise<void> {
		if (this.isSaving) return;
		this.isSaving = true;

		// Sort item IDs for human-readability
		this.settings.appIcons = Object.fromEntries(Object.entries(this.settings.appIcons).sort());
		this.settings.tabIcons = Object.fromEntries(Object.entries(this.settings.tabIcons).sort());
		this.settings.fileIcons = Object.fromEntries(Object.entries(this.settings.fileIcons).sort());
		this.settings.bookmarkIcons = Object.fromEntries(Object.entries(this.settings.bookmarkIcons).sort());
		this.settings.propertyIcons = Object.fromEntries(Object.entries(this.settings.propertyIcons).sort());
		this.settings.ribbonIcons = Object.fromEntries(Object.entries(this.settings.ribbonIcons).sort());

		// Pause before writing to storage, in case the current state cause an instant crash
		await new Promise<void>((resolve) => window.setTimeout(resolve, 300));

		// Save and backup settings
		await this.saveData(this.settings);
		await this.saveBackup();
		this.isSaving = false;
	}

	/**
	 * Backup settings into a numbered backup file.
	 */
	async saveBackup(): Promise<void> {
		const dataPath = this.path;
		const backupPath = normalizePath(dataPath + '.backup');
		const { adapter } = this.app.vault;

		// Determine if a new backup is due for creation
		const backupStat = await adapter.stat(backupPath + 1);
		const timeSinceLastBackup = Date.now() - (backupStat?.mtime ?? 0);
		const isDueForBackup = this.settings.maxBackups > 0 && timeSinceLastBackup >= HOUR * 3;

		// Loop through backup files
		for (let i = 10; i--; i === 0) {
			if (await adapter.exists(backupPath + i)) {
				if (i > this.settings.maxBackups || (isDueForBackup && i === this.settings.maxBackups)) {
					// Delete any backup numbered higher than the maximum, or due for replacement
					await adapter.remove(backupPath + i);
				} else if (isDueForBackup && i < this.settings.maxBackups) {
					// Increment backup number
					await adapter.rename(backupPath + i, backupPath + (i + 1));
				}
			}
		}

		// Create new backup if necessary
		if (isDueForBackup) {
			await adapter.copy(dataPath, backupPath + 1);
		}
	}
}
