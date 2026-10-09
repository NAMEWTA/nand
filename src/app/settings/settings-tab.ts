import type { App } from 'obsidian';
import type DashboardPlugin from '../main';
import { renderHomeSettings } from './home';
import type { SettingsProduct } from './nav';


/** App-owned settings renderers for the workbench settings page (modules render their own pages). */
export class DashboardSettingTab {
	declare renderHomeSettings: (containerEl: HTMLElement) => void;

	plugin: DashboardPlugin;

	/** Detached host element (renderers that query their own container use it). */
	readonly containerEl = createDiv();

	constructor(readonly app: App, plugin: DashboardPlugin) {
		this.plugin = plugin;
	}

	private readonly subscriptions = new Map<string, () => void>();

	/** Keep one live subscription per key while the tab is shown (a re-render replaces it). */
	keepSubscription(key: string, off: () => void): void {
		this.subscriptions.get(key)?.();
		this.subscriptions.set(key, off);
	}

	/** Release subscriptions (the settings page closed). */
	dispose(): void {
		for (const off of this.subscriptions.values()) off();
		this.subscriptions.clear();
		this.workbenchRenderers.clear();
	}

	private readonly workbenchRenderers = new Set<() => void>();

	/** A workbench settings page re-renders through this when sections change. */
	onRefresh(render: () => void): () => void {
		this.workbenchRenderers.add(render);
		return () => this.workbenchRenderers.delete(render);
	}

	/** Render a product that has no module-owned settings page yet. */
	renderProduct(host: HTMLElement, product: SettingsProduct): void {
		host.addClass('dashboard-settings-content');
		if (product === 'home') this.renderHomeSettings(host);
	}

	/** Redraw when the sections themselves change. */
	refresh(): void {
		(this as unknown as { update?: () => void }).update?.();
		for (const render of [...this.workbenchRenderers]) render();
	}
}

DashboardSettingTab.prototype.renderHomeSettings = renderHomeSettings;
