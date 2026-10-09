import { habitDocuments } from '../../core/habit/documents';
import { MarkdownCollectionStorage } from '../../../../host/obsidian/storage/document-collection';
import type { App } from 'obsidian';
import { HabitApplication } from '../../core/habit/application';
import type { WidgetSettingsHost } from '../widget-settings-host';
/** Native focus synchronization and storage wiring for this application instance. */
export class HabitService extends HabitApplication {
	private readonly storage: MarkdownCollectionStorage<import('../../core/habit/model').HabitData>;
	private readonly unsubscribeStorage: () => void;
	private readonly focusDoc: Document;
	private disposed = false;
	private requested = false;
	private syncing: Promise<void> | null = null;
	private layoutSettled = false;
	isLoading = true;
	get readyForEdits(): boolean { return !this.isLoading && !this.saveState.error; }
	private focusHandler = () => {
		if (this.focusDoc.visibilityState === 'visible') this.requestSync();
	};
	constructor(private plugin: WidgetSettingsHost) {
		const storage = new MarkdownCollectionStorage(plugin.app, habitDocuments, 'domain/habits.json');
		super(storage, 'domain');
		this.storage = storage;
		this.unsubscribeStorage = storage.subscribeInvalidation(() => this.requestSync());
		this.focusDoc = plugin.app.workspace.containerEl.ownerDocument ?? activeDocument;
		this.focusDoc.addEventListener('visibilitychange', this.focusHandler);
		// Never await onLayoutReady inside plugin.onload: the host completes loading first.
		plugin.app.workspace.onLayoutReady(() => {
			if (this.disposed) return;
			this.layoutSettled = true;
			storage.invalidateAll();
			this.requestSync();
		});
	}
	private requestSync(): void {
		if (this.disposed) return;
		this.requested = true;
		if (this.syncing) return;
		const run = Promise.resolve().then(async () => {
			while (this.requested && !this.disposed) {
				this.requested = false;
				await this.syncFromDisk();
			}
		});
		this.syncing = run;
		void run.finally(() => {
			this.syncing = null;
			if (this.requested && !this.disposed) this.requestSync();
		}).catch(() => undefined);
	}
	override async syncFromDisk(): Promise<void> {
		await super.syncFromDisk();
		if (!this.disposed && this.layoutSettled) {
			this.isLoading = false;
			this.notify();
		}
	}
	getApp(): App { return this.plugin.app; }
	override destroy(): void {
		this.disposed = true;
		this.unsubscribeStorage();
		this.focusDoc.removeEventListener('visibilitychange', this.focusHandler);
		void this.shutdown().catch(() => undefined).finally(() => this.storage.dispose());
		super.destroy();
	}
}
