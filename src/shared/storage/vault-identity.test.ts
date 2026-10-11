import { expect, test } from 'vitest';
import { initializeVaultIdentity, type IdentityOptions } from './vault-identity';
import type { TextStorage } from './ports';

function fixture() {
	const files = new Map<string, string>();
	const storage: TextStorage = { exists: async path => files.has(path), read: async path => { const text = files.get(path); if (text === undefined) throw new Error('missing'); return text; }, write: async (path, text) => { files.set(path, text); }, mkdir: async () => {} };
	return { storage, files };
}
const options = (machineIdentity?: string): IdentityOptions => ({ machineIdentity, label: '设备甲', chooseDevice: async () => ({ label: '手机' }) });
test('same host resumes its vault identity; a synced copy cannot claim another device', async () => {
	const f = fixture();
	const first = await initializeVaultIdentity(f.storage, options('machine-a:user-a'));
	expect(await initializeVaultIdentity(f.storage, options('machine-a:user-a'))).toEqual(first);
	const copied = fixture(); for (const [path, text] of f.files) copied.files.set(path, text);
	const second = await initializeVaultIdentity(copied.storage, options('machine-b:user-a'));
	expect(second.vaultId).toBe(first.vaultId); expect(second.deviceId).not.toBe(first.deviceId);
	expect([...copied.files.values()].join()).not.toContain('machine-a');
	expect([...copied.files.values()].join()).not.toContain('machine-b');
	const other = await initializeVaultIdentity(fixture().storage, options('machine-a:user-a'));
	expect(other.vaultId).not.toBe(first.vaultId);
	expect([...f.files.keys()].every(path => path.startsWith('.nand/'))).toBe(true);
});
test('migration reuses an unclaimed legacy identity and requires explicit selection without host identity', async () => {
	const f = fixture(), legacy = '11111111-1111-4111-8111-111111111111';
	const first = await initializeVaultIdentity(f.storage, { ...options('first'), legacyDeviceId: legacy, legacyBrowserVaultId: legacy });
	expect(first.deviceId).toBe(legacy); expect(first.legacyBrowserVaultId).toBe(legacy);
	const second = await initializeVaultIdentity(f.storage, { ...options('second'), legacyDeviceId: legacy });
	expect(second.deviceId).not.toBe(legacy);
	const chosen = await initializeVaultIdentity(f.storage, { ...options(), chooseDevice: async devices => { expect(devices.length).toBe(2); return first.deviceId; } });
	expect(chosen).toEqual(first);
	await expect(initializeVaultIdentity(f.storage, { ...options(), chooseDevice: async () => 'missing' })).rejects.toThrow('unknown-device');
});
test('identity write failures are surfaced and do not return an unpersisted device', async () => {
	const f = fixture();
	f.storage.write = async () => { throw new Error('disk'); };
	await expect(initializeVaultIdentity(f.storage, options('first'))).rejects.toThrow('disk');
	expect(f.files.size).toBe(0);
});

test('the first confirmed identity survives primary corruption without minting a new vault or device', async () => {
	const f = fixture(), first = await initializeVaultIdentity(f.storage, options('machine'));
	f.files.set('.nand/config/identity.json', '{');
	expect(await initializeVaultIdentity(f.storage, options('machine'))).toEqual(first);
	f.files.delete('.nand/config/identity.json');
	expect(await initializeVaultIdentity(f.storage, options('machine'))).toEqual(first);
});

test('an empty legacy backup never turns a damaged existing identity into a fresh installation', async () => {
	const f = fixture();
	f.files.set('.nand/config/identity.json', '{');
	f.files.set('.nand/config/identity.json.backup', 'null');
	await expect(initializeVaultIdentity(f.storage, options('machine'))).rejects.toThrow('identity');
	expect(f.files.get('.nand/config/identity.json')).toBe('{');
});

test('first identity primary-write failure can retry from the already verified full mapping', async () => {
	const f = fixture(), write = f.storage.write;
	let fail = true;
	f.storage.write = async (path, text) => {
		if (path === '.nand/config/identity.json' && fail) { fail = false; throw new Error('temporary'); }
		await write(path, text);
	};
	await expect(initializeVaultIdentity(f.storage, options('machine'))).rejects.toThrow('temporary');
	const backup = JSON.parse(f.files.get('.nand/config/identity.json.backup')!);
	const recovered = await initializeVaultIdentity(f.storage, options('machine'));
	expect(recovered.vaultId).toBe(backup.vaultId);
	expect(backup.devices[recovered.deviceId]).toBeDefined();
});
