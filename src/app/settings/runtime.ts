import { getLanguage as obsidianLanguage, type App } from 'obsidian';
import { JsonStore } from '../../shared/json-store';
import { SettingsStore, type SettingsFile } from '../../shared/settings/store';
import type { SettingsScope } from '../../shared/settings/schema';
import { t } from '../../shared/i18n/index';
import { deviceId } from '../../host/obsidian/storage/device-id';
import { homeSettings, seedDashboardSettings } from '../../modules/home/settings';
import { archivesSettings } from '../../modules/archives/settings';
import { browserSettings } from '../../modules/browser/settings';
import { commentsSettings } from '../../modules/comments/settings';
import { appSchema } from './app-schema';
import { themeSettings, type ThemeSettings } from '../../theme/settings';
import type { SettingsHandle } from '../../shared/settings/store';
import type { AppSettings } from './app-schema';
import type { DashboardSettings } from '../../modules/home/settings';
import type { ContactsSettings } from '../../shared/contacts-settings';
import type { BrowserSettings } from '../../modules/browser/settings';
import type { CommentsSettings } from '../../modules/comments/settings';

const VAULT_FILE = '.nand/config/settings.json';

/** Namespaces the app binds at load (the rest are bound by their modules). */
export interface AppNamespaces {
	app: SettingsHandle<AppSettings>;
	home: SettingsHandle<DashboardSettings>;
	archives: SettingsHandle<ContactsSettings>;
	browser: SettingsHandle<BrowserSettings>;
	comments: SettingsHandle<CommentsSettings>;
}

export interface SettingsRuntime {
	readonly store: SettingsStore;
	readonly ns: AppNamespaces;
	/** Global theme (Settings → Appearance). */
	readonly theme: SettingsHandle<ThemeSettings>;
	/** True on the first load in this vault (defaults were seeded). */
	readonly firstRun: boolean;
}

/** Interface language for a new vault: Obsidian's language when it is Chinese, otherwise English. */
export function defaultLanguage(): 'en' | 'zh' {
	try {
		return obsidianLanguage().toLowerCase().startsWith('zh') ? 'zh' : 'en';
	} catch {
		return 'en';
	}
}

export async function loadSettingsRuntime(app: App): Promise<SettingsRuntime> {
	const adapter = app.vault.adapter;
	const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
	const stores: Record<SettingsScope, JsonStore<Record<string, unknown> | null>> = {
		vault: new JsonStore(adapter, VAULT_FILE, (value): value is Record<string, unknown> | null => value === null || isObject(value)),
		device: new JsonStore(adapter, `.nand/config/devices/${deviceId(app)}.json`, (value): value is Record<string, unknown> | null => value === null || isObject(value)),
	};
	const store = new SettingsStore({
		load: async (scope) => (await stores[scope].load(null)) as SettingsFile | null,
		save: (scope, file) => stores[scope].save(file as unknown as Record<string, unknown>),
	}, { timers: { set: (callback, ms) => window.setTimeout(callback, ms), clear: (handle) => window.clearTimeout(handle as number) } });
	await store.load();
	const firstRun = store.empty;
	const ns: AppNamespaces = {
		app: store.bind('app', appSchema(defaultLanguage())),
		home: store.bind('home', homeSettings),
		archives: store.bind('archives', archivesSettings),
		browser: store.bind('browser', browserSettings),
		comments: store.bind('comments', commentsSettings),
	};
	if (firstRun) {
		await ns.home.update((draft) => seedDashboardSettings(draft, { countdown: t('defaults.countdownLabel'), anniversary: t('defaults.anniversaryLabel') }));
		app.saveLocalStorage('nand.dashboard.sidebar-pinned', 'true');
		await Promise.all([ns.app.touch(), ns.archives.touch(), ns.browser.touch(), ns.comments.touch()]);
	}
	return { store, ns, theme: store.bind('theme', themeSettings), firstRun };
}
