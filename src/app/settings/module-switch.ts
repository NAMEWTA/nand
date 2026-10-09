import type { ModuleId } from '../contracts/module';
import type { SettingsHandle } from '../../shared/settings/store';
import type { AppSettings } from './app-schema';

/**
 * Turn a module on or off: write the switch first, then start or stop the module (`apply`).
 * A failed write restores the previous value; a failed start/stop keeps the new value so it can be retried.
 */
export async function switchModule(app: SettingsHandle<AppSettings>, id: ModuleId, enabled: boolean, apply: () => Promise<void>): Promise<void> {
	const previous = app.get().modules[id];
	try {
		await app.update((draft) => { draft.modules[id] = enabled; }, { persist: 'immediate' });
	} catch (error) {
		void app.update((draft) => { draft.modules[id] = previous; }).catch(() => undefined);
		throw error;
	}
	await apply();
}
