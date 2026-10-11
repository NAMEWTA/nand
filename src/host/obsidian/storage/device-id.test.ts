import type { App } from 'obsidian';
import { expect, test } from 'vitest';
import { deviceId, initializeDevice } from './device-id';

test('legacy host keys are cleared only after vault identity verification succeeds', async () => {
	const files = new Map<string, string>(), legacy = '11111111-1111-4111-8111-111111111111';
	const local = new Map<string, unknown>([['nand.device-id', legacy], ['nand.browser.vault-id', legacy]]);
	let fail = true;
	const app = { loadLocalStorage: (key: string) => local.get(key), saveLocalStorage: (key: string, value: unknown) => { expect(value).toBe(null); local.delete(key); }, vault: { adapter: {
		exists: async (path: string) => files.has(path), read: async (path: string) => files.get(path)!, mkdir: async () => {},
		write: async (path: string, text: string) => { if (fail) throw new Error('disk'); files.set(path, text); },
	} } } as unknown as App;
	const options = { machineIdentity: async () => 'machine:user', label: 'Test', chooseDevice: async () => ({ label: 'Manual' }) };
	expect(() => deviceId(app)).toThrow('not-initialized');
	await expect(initializeDevice(app, options)).rejects.toThrow('disk');
	expect(local.size).toBe(2); expect(() => deviceId(app)).toThrow('not-initialized');
	fail = false; await initializeDevice(app, options);
	expect(local.size).toBe(0); expect(deviceId(app)).toBe(legacy);
	expect(files.has('.nand/config/identity.json')).toBe(true);
});
