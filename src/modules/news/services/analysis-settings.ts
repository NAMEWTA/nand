import type { SettingsHandle } from '../../../shared/settings/store';
import type { NewsSettings } from '../settings';

/** A failed write restores only unchanged fields from this edit, preserving concurrent edits. */
export async function saveAnalysisSettings(handle: SettingsHandle<NewsSettings>, recipe: (settings: NewsSettings) => void): Promise<void> {
	const before = structuredClone(handle.get());
	const pending = handle.update(recipe);
	const written = structuredClone(handle.get());
	const keys = (Object.keys(written) as (keyof NewsSettings)[]).filter(key => JSON.stringify(before[key]) !== JSON.stringify(written[key]));
	try { await pending; }
	catch (error) {
		await handle.update(settings => {
			for (const key of keys) if (JSON.stringify(settings[key]) === JSON.stringify(written[key])) Object.assign(settings, { [key]: before[key] });
		}, { persist: 'immediate' }).catch(() => undefined);
		throw error;
	}
}
