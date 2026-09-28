/** Settings chrome shared by the declarative tab and the pre-1.13 fallback.
 *  Open products sit on one top row. Section ids are the order stacked on that tab. */

export type SettingsProduct =
	'home' | 'dashboard' | 'editor' | 'terminal' | 'iconic' | 'contacts' | 'automation' | 'sync';

export type SettingsPage =
	| 'contacts-storage'
	| 'home'
	| 'general'
	| 'widgets'
	| 'coffee'
	| 'comments'
	| 'copy'
	| 'automation'
	| 'sync'
	| 'shell'
	| 'instance'
	| 'workflows'
	| 'appearance'
	| 'behavior'
	| 'connection'
	| 'visibility'
	| 'agents'
	| 'iconic-general'
	| 'iconic-sidebars'
	| 'iconic-editor'
	| 'iconic-menus'
	| 'iconic-picker'
	| 'iconic-advanced';

export const secondaryAxis = 'vertical' as const;

export function productOrder(): SettingsProduct[] {
	return ['home', 'dashboard', 'editor', 'terminal', 'iconic', 'contacts', 'automation', 'sync'];
}

export interface ModuleGates {
	dashboard: boolean;
	editor: boolean;
	terminal: boolean;
	contacts: boolean;
	iconic: boolean;
}

/** Top tabs. Home and sync stay. Board, editor, and agents appear only while open. */
export function visibleProducts(modules: ModuleGates): SettingsProduct[] {
	return productOrder().filter((product) => {
		if (product === 'home' || product === 'automation' || product === 'sync') return true;
		return modules[product];
	});
}

/** Section order stacked on a product tab. Home and sync have no extra sections. */
export function sidePages(product: SettingsProduct): SettingsPage[] {
	if (product === 'dashboard') return ['general', 'widgets', 'coffee'];
	if (product === 'editor') return ['comments', 'copy'];
	if (product === 'contacts') return ['contacts-storage'];
	if (product === 'iconic')
		return [
			'iconic-general',
			'iconic-sidebars',
			'iconic-editor',
			'iconic-menus',
			'iconic-picker',
			'iconic-advanced',
		];
	if (product === 'terminal') {
		return ['shell', 'instance', 'workflows', 'appearance', 'behavior', 'connection', 'visibility', 'agents'];
	}
	return [];
}

export function defaultPage(product: SettingsProduct): SettingsPage {
	if (product === 'editor') return 'comments';
	if (product === 'contacts') return 'contacts-storage';
	if (product === 'terminal') return 'shell';
	if (product === 'iconic') return 'iconic-general';
	if (product === 'automation') return 'automation';
	if (product === 'sync') return 'sync';
	if (product === 'home') return 'home';
	return 'general';
}
