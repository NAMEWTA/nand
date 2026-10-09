import { t } from '../../shared/i18n';
import type { PanelModel } from '../contracts/workbench';
import { productGates, visibleProducts, type SettingsProduct } from '../settings/nav';
import type DashboardPlugin from '../main';

/** Settings categories: General and Appearance, one page per visible product, then About. */
export function settingsCategories(plugin: DashboardPlugin): Array<{ id: string; label: string; icon: string }> {
	const products: Record<Exclude<SettingsProduct, 'home'>, { labelKey: string; icon: string }> = {
		dashboard: { labelKey: 'settings.productDashboard', icon: 'layout-dashboard' },
		browser: { labelKey: 'browser.title', icon: 'globe' },
		editor: { labelKey: 'settings.productEditor', icon: 'message-square' },
		terminal: { labelKey: 'settings.productTerminal', icon: 'terminal' },
		iconic: { labelKey: 'modules.iconic', icon: 'images' },
		contacts: { labelKey: 'contacts.title', icon: 'contact-round' },
		automation: { labelKey: 'automation.title', icon: 'workflow' },
		sync: { labelKey: 'workbench.sync', icon: 'git-branch' },
	};
	return [
		{ id: 'general', label: t('settings.tabGeneral'), icon: 'settings' },
		{ id: 'appearance', label: t('appearance.title'), icon: 'palette' },
		// Icon settings live on the Icons page itself, not in a second place.
		...visibleProducts(productGates((id) => plugin.moduleEnabled(id)))
			.filter((product): product is Exclude<SettingsProduct, 'home' | 'iconic'> => product !== 'home' && product !== 'iconic')
			.map((product) => ({ id: product, label: t(products[product].labelKey), icon: products[product].icon })),
		{ id: 'about', label: t('settings.tabAbout'), icon: 'info' },
	];
}

export function settingsPanel(plugin: DashboardPlugin, current?: string): PanelModel {
	const active = current ?? 'general';
	return {
		searchable: true,
		sections: [{
			id: 'categories',
			items: settingsCategories(plugin).map((category) => ({
				id: category.id,
				label: category.label,
				icon: category.icon,
				target: { feature: 'settings', section: category.id },
				active: category.id === active,
			})),
		}],
	};
}
