import { Notice, type App } from 'obsidian';
import { defineSettings, f } from '../../../shared/settings/schema';
import type { SettingsHandle, SettingsStore } from '../../../shared/settings/store';
import { t } from '../../../shared/i18n';

export const LEGACY_PREFERENCE_KEYS = [
	'nand.dashboard.sidebar-pinned', 'nand.dashboard.banner-collapsed', 'nand.dashboard.holiday-cache',
	'nand.dashboard.media-thumb-size', 'nand.dashboard.media-collapsed', 'nand.dashboard.note-popover-mode',
	'nand.dashboard.pomodoro-mini-pos', 'nand.dashboard.reading-mini-pos',
] as const;
interface Preferences { migrated: boolean; values: Record<string, unknown> }
export const preferencesSchema = defineSettings({
	migrated: f.boolean({ default: false, scope: 'device' }),
	values: f.custom<Record<string, unknown>>({ default: {}, scope: 'device', normalize: raw => raw && typeof raw === 'object' && !Array.isArray(raw)
		? Object.fromEntries(Object.entries(raw).filter(([key]) => LEGACY_PREFERENCE_KEYS.some(known => known === key))) : {} }),
});
const handles = new WeakMap<App, SettingsHandle<Preferences>>();
/** The composition root supplies the namespaced settings handle; views never own another store. */
export function bindVaultPreferences(app: App, handle: SettingsHandle<Preferences>): void { handles.set(app, handle); }
function preferences(app: App): SettingsHandle<Preferences> {
	const handle = handles.get(app);
	if (!handle) throw new Error('nand-storage.preferences-not-initialized');
	return handle;
}
export async function initializeVaultPreferences(app: App, store: SettingsStore): Promise<void> {
	const handle = store.bind('local-ui', preferencesSchema);
	bindVaultPreferences(app, handle);
	const legacy: Record<string, unknown> = {};
	for (const key of LEGACY_PREFERENCE_KEYS) {
		const value: unknown = app.loadLocalStorage(key);
		if (value !== null && value !== undefined) legacy[key] = value;
	}
	if (!handle.get().migrated) {
		await handle.update(draft => { draft.values = { ...legacy, ...draft.values }; draft.migrated = true; }, { persist: 'immediate' });
	} else if (Object.keys(legacy).length) await handle.touch({ persist: 'immediate' });
	for (const key of LEGACY_PREFERENCE_KEYS) app.saveLocalStorage(key, null);
}
export function getVaultPreference(app: App, key: string): unknown { return preferences(app).get().values[key]; }
export function setVaultPreference(app: App, key: string, value: unknown): void {
	if (!LEGACY_PREFERENCE_KEYS.some(known => known === key)) throw new Error('nand-storage.unknown-preference');
	void preferences(app).update(draft => { draft.values[key] = value; }).catch((error: unknown) => {
		console.error('[NAND preferences]', error);
		new Notice(t('storage.preferenceFailed'));
	});
}
