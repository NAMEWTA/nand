import { habitDocuments } from '../../../core/habit/documents';
import { MarkdownCollectionStorage } from '../storage/document-collection';
import type { App } from 'obsidian';
import { HabitApplication } from '../../../core/habit/application';
import type { WidgetSettingsHost } from '../settings-host';
const services = new WeakMap<App, HabitService>();
export function registerHabitService(app: App, service: HabitService | null): void {
	if (service) services.set(app, service);
	else services.delete(app);
}
export function getHabitService(app: App): HabitService | null {
	return services.get(app) ?? null;
}
/** Native focus synchronization and storage wiring for this application instance. */
export class HabitService extends HabitApplication {
	private readonly storageCleanup: () => void;
	private focusDoc: Document;
	private focusHandler = () => {
		if (this.focusDoc.visibilityState === 'visible') void this.syncFromDisk();
	};
	constructor(private plugin: WidgetSettingsHost) {
		const storage = new MarkdownCollectionStorage(plugin.app, habitDocuments, 'domain/habits.json');
		super(storage, 'domain');
		this.storageCleanup = () => storage.dispose();
		this.focusDoc = activeDocument;
		this.focusDoc.addEventListener('visibilitychange', this.focusHandler);
	}

	getApp(): App { return this.plugin.app; }
	override destroy(): void {
		this.focusDoc.removeEventListener('visibilitychange', this.focusHandler);
		void this.shutdown().catch(() => undefined).finally(this.storageCleanup);
		super.destroy();
	}
}
