import { t } from '../../shared/i18n';
import type { PanelModel } from '../contracts/workbench';

const PAGES = [
	{ id: 'iconic-general', labelKey: 'settings.tabGeneral', icon: 'settings' },
	{ id: 'iconic-sidebars', labelKey: 'iconic.settings.headingSidebarsAndTabs', icon: 'panel-left' },
	{ id: 'iconic-editor', labelKey: 'iconic.settings.headingEditor', icon: 'file-text' },
	{ id: 'iconic-menus', labelKey: 'iconic.settings.headingMenusAndDialogs', icon: 'menu' },
	{ id: 'iconic-picker', labelKey: 'iconic.settings.headingIconPicker', icon: 'search' },
	{ id: 'iconic-advanced', labelKey: 'iconic.settings.headingAdvanced', icon: 'sliders-horizontal' },
] as const;

export function iconsPanel(current?: string): PanelModel {
	return {
		sections: [{
			id: 'pages',
			items: PAGES.map((page) => ({ id: page.id, label: t(page.labelKey), icon: page.icon, target: { feature: 'icons', section: page.id }, active: page.id === (current ?? 'iconic-general') })),
		}],
	};
}

export function iconsTitle(section: string | undefined): string {
	const page = PAGES.find((item) => item.id === section) ?? PAGES[0];
	return `${t('modules.iconic')} · ${t(page.labelKey)}`;
}
