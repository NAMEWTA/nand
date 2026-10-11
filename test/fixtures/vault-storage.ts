import type { App } from 'obsidian';
import { initializeDevice } from '../../src/host/obsidian/storage/device-id';
import { bindVaultPreferences } from '../../src/host/obsidian/storage/preferences';

/** Tests enter the same initialization boundary as plugin startup; no global-storage fallback is installed. */
export async function initializeTestDevice(app: App): Promise<void> {
	app.loadLocalStorage ??= () => null;
	app.saveLocalStorage ??= () => {};
	await initializeDevice(app, { machineIdentity: async () => 'test-machine', label: 'Test', chooseDevice: async () => { throw new Error('unexpected manual choice'); } });
}

/** Presentation-only fixtures expose an injected settings handle and inspect its edits. */
export function bindTestPreferences(app: App, values: Record<string, unknown> = {}): void {
	bindVaultPreferences(app, {
		get: () => ({ migrated: true, values }),
		update: async recipe => { const draft = { migrated: true, values: structuredClone(values) }; const next = recipe(draft) ?? draft; for (const key of Object.keys(values)) delete values[key]; Object.assign(values, next.values); },
		touch: async () => {}, subscribe: () => () => {}, select: () => () => {},
	});
}
