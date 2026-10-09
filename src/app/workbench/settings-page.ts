import { t } from '../../shared/i18n';
import { NativeSurface, type NativeSurfaceContext } from '../../ui/native-surface';
import type { WorkbenchContribution } from '../contracts/workbench-host';
import type { SettingsProduct } from '../settings/nav';
import { settingsCategories } from './settings-categories';
import { renderAppearanceSection, renderModuleToggles, renderPreferences } from '../settings/home';
import type DashboardPlugin from '../main';
import { DashboardSettingTab } from '../settings/settings-tab';
import { renderCopyHelp } from '../settings/editor-settings';
import { renderAbout } from '../settings/about';
import { PRODUCT_MODULES } from '../settings/nav';
import type { ModuleId } from '../contracts/module';

/** Settings categories (product ids) owned by a module. */
const CATEGORY_MODULES: Readonly<Record<string, ModuleId>> = PRODUCT_MODULES;

class SettingsSurface extends NativeSurface {
	private category = 'general';
	private renderId = 0;
	private kept: Array<() => void> = [];

	constructor(context: NativeSurfaceContext, private readonly plugin: DashboardPlugin, private readonly tab: DashboardSettingTab) {
		super(context);
	}
	getViewType(): string {
		return 'nand-settings';
	}
	getDisplayText(): string {
		return t('workbench.settings');
	}
	getIcon(): string {
		return 'settings';
	}
	onOpen(): Promise<void> {
		this.contentEl.addClass('nand-settings-page-host');
		this.register(this.tab.onRefresh(() => this.render()));
		this.render();
		return Promise.resolve();
	}
	onClose(): Promise<void> {
		this.release();
		this.tab.dispose();
		return Promise.resolve();
	}
	private release(): void {
		for (const off of this.kept.splice(0)) off();
	}

	show(category: string | undefined): void {
		const next = settingsCategories(this.plugin).some((item) => item.id === category) ? category! : 'general';
		if (next === this.category && this.contentEl.hasChildNodes()) return;
		this.category = next;
		this.render();
	}
	get current(): string {
		return this.category;
	}
	private render(): void {
		const id = ++this.renderId;
		this.release();
		this.contentEl.empty();
		const page = this.contentEl.createDiv({ cls: 'nand-settings-page' });
		const category = settingsCategories(this.plugin).find((item) => item.id === this.category);
		page.createEl('h2', { cls: 'nand-settings-page-title', text: category?.label ?? t('workbench.settings') });
		const body = page.createDiv({ cls: 'nand-settings-page-body' });
		switch (this.category) {
			case 'general':
				renderPreferences.call(this.tab, body);
				renderModuleToggles.call(this.tab, body);
				renderCopyHelp(body);
				return;
			case 'appearance':
				renderAppearanceSection.call(this.tab, body);
				return;
			case 'about':
				renderAbout(body);
				return;
			default: {
				// Modules that own their settings page render it; the rest still use the shared settings tab.
				const module = CATEGORY_MODULES[this.category];
				const load = module ? this.plugin.moduleInstance(module)?.settingsPage : undefined;
				if (!load) {
					this.tab.renderProduct(body, this.category as SettingsProduct);
					return;
				}
				void load()
					.then((renderPage) => {
						if (id !== this.renderId) return;
						body.addClass('dashboard-settings-content');
						renderPage(body, { refresh: () => this.render(), keep: (off) => this.kept.push(off) });
					})
					.catch((error: unknown) => body.setText(error instanceof Error ? error.message : String(error)));
			}
		}
	}
}

export const createSettingsPage = (plugin: DashboardPlugin): WorkbenchContribution['create'] => async (context, target) => {
	const surface = new SettingsSurface(context, plugin, new DashboardSettingTab(plugin.app, plugin));
	surface.show(target.section);
	return {
		surface,
		getTarget: () => ({ feature: 'settings', section: surface.current }),
		navigate: async (next) => surface.show(next.section),
	};
};
