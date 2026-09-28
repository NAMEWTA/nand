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
	private focusDoc: Document;
	private focusHandler = () => {
		if (this.focusDoc.visibilityState === 'visible') void this.syncFromDisk();
	};
	constructor(private plugin: WidgetSettingsHost) {
		super(
			plugin.app.vault.adapter,
			`${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`,
			() => plugin.settings.expenseCurrency,
		);
		this.focusDoc = activeDocument;
		this.focusDoc.addEventListener('visibilitychange', this.focusHandler);
	}
	getApp(): App {
		return this.plugin.app;
	}
	override destroy(): void {
		this.focusDoc.removeEventListener('visibilitychange', this.focusHandler);
		super.destroy();
	}
}
