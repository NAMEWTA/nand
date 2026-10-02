import { expenseDocuments } from '../../../core/expense/documents';
import { MarkdownCollectionStorage } from '../storage/document-collection';
import type { App } from 'obsidian';
import { ExpenseApplication } from '../../../core/expense/application';
import type { WidgetSettingsHost } from '../settings-host';
const services = new WeakMap<App, ExpenseService>();
export function registerExpenseService(app: App, service: ExpenseService | null): void {
	if (service) services.set(app, service);
	else services.delete(app);
}
export function getExpenseService(app: App): ExpenseService | null {
	return services.get(app) ?? null;
}
/** Native focus synchronization and storage wiring for this application instance. */
export class ExpenseService extends ExpenseApplication {
	private readonly storageCleanup: () => void;
	private focusDoc: Document;
	private focusHandler = () => {
		if (this.focusDoc.visibilityState === 'visible') void this.syncFromDisk();
	};
	constructor(private plugin: WidgetSettingsHost) {
		const storage = new MarkdownCollectionStorage(plugin.app, expenseDocuments, 'domain/expense.json');
		super(
			storage,
			'domain',
			() => plugin.settings.expenseCurrency,
		);
		this.storageCleanup = () => storage.dispose();
		this.focusDoc = activeDocument;
		this.focusDoc.addEventListener('visibilitychange', this.focusHandler);
	}
	getApp(): App {
		return this.plugin.app;
	}
	override destroy(): void {
		this.focusDoc.removeEventListener('visibilitychange', this.focusHandler);
		void this.shutdown().catch(() => undefined).finally(this.storageCleanup);
		super.destroy();
	}
}
