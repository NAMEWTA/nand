import { describe, expect, it } from 'vitest';
import { SettingsStore, type SettingsFile } from '../../shared/settings/store';
import { appSchema } from './app-schema';
import { switchModule } from './module-switch';

function setup() {
	let failWrites = false;
	const saved: SettingsFile[] = [];
	const store = new SettingsStore({
		load: async () => null,
		save: async (scope, file) => {
			if (failWrites) throw new Error('disk full');
			if (scope === 'vault') saved.push(structuredClone(file));
		},
	}, { timers: { set: (callback) => { queueMicrotask(callback); return 0; }, clear: () => {} } });
	return { store, saved, failWrites: (value: boolean) => { failWrites = value; } };
}

describe('switchModule', () => {
	it('writes the switch before starting or stopping the module', async () => {
		const { store, saved } = setup();
		await store.load();
		const app = store.bind('app', appSchema('en'));
		const order: string[] = [];
		await switchModule(app, 'automations', false, async () => { order.push(`apply:${saved.length}`); });
		expect(app.get().modules.automations).toBe(false);
		expect(order).toEqual(['apply:1']);
	});

	it('restores the previous value when the write fails and does not apply', async () => {
		const { store, failWrites } = setup();
		await store.load();
		const app = store.bind('app', appSchema('en'));
		failWrites(true);
		let applied = false;
		await expect(switchModule(app, 'automations', false, async () => { applied = true; })).rejects.toThrow('disk full');
		expect(app.get().modules.automations).toBe(true);
		expect(applied).toBe(false);
	});

	it('keeps the saved value when starting or stopping fails, so the switch can be retried', async () => {
		const { store } = setup();
		await store.load();
		const app = store.bind('app', appSchema('en'));
		await expect(switchModule(app, 'automations', false, async () => { throw new Error('stop failed'); })).rejects.toThrow('stop failed');
		expect(app.get().modules.automations).toBe(false);
	});
});
