import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { nativeVaultStorage } from '../../../../host/desktop/vault-storage';
import { EMPTY_DEVICE_STATE } from '../../core/ports';
import { SyncDeviceStore, syncStatePath } from './device-state';

test('legacy Git bookkeeping is verified in the vault, then removed; another device starts independently', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'nand-sync-state-'));
	try {
		await mkdir(path.join(root, '.git'));
		const legacy = path.join(root, '.git/nand-sync.json'), original = { ...EMPTY_DEVICE_STATE, paused: 'manual' as const, lastPull: 42 };
		await writeFile(legacy, JSON.stringify(original));
		const storage = nativeVaultStorage(root), first = new SyncDeviceStore(storage, root, 'device-a');
		expect(await first.load(root, legacy)).toEqual(original);
		const file = syncStatePath(root, root, 'device-a'); expect(file).toMatch(/^\.nand\/sync\/device-a\/[a-f\d]{64}\.json$/);
		expect(JSON.parse(await readFile(path.join(root, file), 'utf8'))).toEqual(original);
		await expect(access(legacy)).rejects.toMatchObject({ code: 'ENOENT' });
		expect(await new SyncDeviceStore(storage, root, 'device-b').load(root, legacy)).toEqual(EMPTY_DEVICE_STATE);
		const external = { ...original, lastPush: 52 }; await writeFile(path.join(root, file), JSON.stringify(external));
		const saved = await first.save(root, original, { ...original, paused: '' });
		expect(saved).toEqual({ ...external, paused: '' });
		expect(await first.save(root, saved, { ...saved, lastPull: 99 })).toEqual({ ...external, paused: '', lastPull: 99 });
	} finally { await rm(root, { recursive: true, force: true }); }
});

test('a failed state migration leaves the legacy file intact and never reports successful persistence', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'nand-sync-failure-'));
	try {
		const legacy = path.join(root, 'nand-sync.json'), original = JSON.stringify(EMPTY_DEVICE_STATE);
		await writeFile(legacy, original);
		const storage = nativeVaultStorage(root), write = storage.write;
		storage.write = async () => { throw new Error('read-only'); };
		const store = new SyncDeviceStore(storage, root, 'device');
		await expect(store.load(root, legacy)).rejects.toThrow('read-only');
		expect(await readFile(legacy, 'utf8')).toBe(original);
		storage.write = write;
		expect(await store.load(root, legacy)).toEqual(EMPTY_DEVICE_STATE);
		await expect(access(legacy)).rejects.toMatchObject({ code: 'ENOENT' });
		storage.write = async () => { throw new Error('disk'); };
		await expect(store.save(root, EMPTY_DEVICE_STATE, { ...EMPTY_DEVICE_STATE, paused: 'manual' })).rejects.toThrow('disk');
	} finally { await rm(root, { recursive: true, force: true }); }
});
