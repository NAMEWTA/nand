/** Settings products (one per module plus Home) and their order in the workbench settings list. */
import type { ModuleId } from '../contracts/module';

export type SettingsProduct = 'home' | 'dashboard' | 'browser' | 'editor' | 'terminal' | 'iconic' | 'contacts' | 'automation' | 'sync';

const ORDER: readonly SettingsProduct[] = ['home', 'dashboard', 'browser', 'editor', 'terminal', 'iconic', 'contacts', 'automation', 'sync'];

export interface ModuleGates {
	browser: boolean;
	dashboard: boolean;
	editor: boolean;
	terminal: boolean;
	contacts: boolean;
	iconic: boolean;
	automation: boolean;
	sync: boolean;
}

/** Products shown in settings: Home always, the others while their module is on. */
export function visibleProducts(modules: ModuleGates): SettingsProduct[] {
	return ORDER.filter((product) => product === 'home' || modules[product]);
}

/** The module behind each product (the product ids are the settings page names). */
export const PRODUCT_MODULES = {
	browser: 'browser',
	dashboard: 'home',
	editor: 'comments',
	terminal: 'agent',
	contacts: 'archives',
	iconic: 'icons',
	automation: 'automations',
	sync: 'sync',
} as const satisfies Record<keyof ModuleGates, ModuleId>;

/** Product gates from the module switches. */
export function productGates(enabled: (id: ModuleId) => boolean): ModuleGates {
	return Object.fromEntries(Object.entries(PRODUCT_MODULES).map(([product, id]) => [product, enabled(id)])) as unknown as ModuleGates;
}
