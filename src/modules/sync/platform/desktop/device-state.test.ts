import { mkdtemp, mkdir, readFile, writeFile, access, rm, symlink } from 'node:fs/promises';
import * as fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, vi } from 'vitest';
import { nativeVaultStorage } from '../../../../host/desktop/vault-storage';
import { EMPTY_DEVICE_STATE } from '../../core/ports';
import { SyncDeviceStore, syncStatePath } from './device-state';
import { desktopGitHost } from './host';

vi.mock('node:fs/promises', async importOriginal => {
	const actual = await importOriginal<typeof import('node:fs/promises')>();
	return { ...actual, unlink: vi.fn(actual.unlink) };
});

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
		await rm(path.join(root, file)); await rm(path.join(root, file + '.backup'));
		expect(await new SyncDeviceStore(storage, root, 'device-a').load(root, legacy)).toEqual(EMPTY_DEVICE_STATE);
	} finally { await rm(root, { recursive: true, force: true }); }
});

test('migration cleanup retries after a verified copy', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'nand-sync-cleanup-'));
	const unlink = vi.mocked(fs.unlink);
	try {
		const legacy = path.join(root, 'nand-sync.json'), original = JSON.stringify(EMPTY_DEVICE_STATE);
		await writeFile(legacy, original);
		const storage = nativeVaultStorage(root);
		unlink.mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 'EACCES' }));
		await expect(new SyncDeviceStore(storage, root, 'device').load(root, legacy)).rejects.toThrow('busy');
		expect(await readFile(legacy, 'utf8')).toBe(original);
		expect(await new SyncDeviceStore(storage, root, 'device').load(root, legacy)).toEqual(EMPTY_DEVICE_STATE);
		await expect(access(legacy)).rejects.toMatchObject({ code: 'ENOENT' });
	} finally { unlink.mockClear(); await rm(root, { recursive: true, force: true }); }
});

test('migration source changes block cutover and remain visible after restart', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'nand-sync-source-'));
	try {
		const legacy = path.join(root, 'nand-sync.json'); await writeFile(legacy, JSON.stringify(EMPTY_DEVICE_STATE));
		const storage = nativeVaultStorage(root), write = storage.write, target = syncStatePath(root, root, 'device');
		storage.write = async (file, value) => { await write(file, value); if (file === target) await writeFile(legacy, JSON.stringify({ ...EMPTY_DEVICE_STATE, paused: 'manual' })); };
		await expect(new SyncDeviceStore(storage, root, 'device').load(root, legacy)).rejects.toThrow('migration');
		expect(JSON.parse(await readFile(legacy, 'utf8')).paused).toBe('manual');
		storage.write = write;
		await expect(new SyncDeviceStore(storage, root, 'device').load(root, legacy)).rejects.toThrow('migration');
	} finally { await rm(root, { recursive: true, force: true }); }
});

test('the actual Git host accepts a vault-root junction and still rejects a repository outside it', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'nand-sync-alias-'));
	try {
		const real = path.join(root, 'real'), alias = path.join(root, 'alias');
		await mkdir(real); await symlink(real, alias, process.platform === 'win32' ? 'junction' : 'dir');
		execFileSync('git', ['init', '-q'], { cwd: real, windowsHide: true });
		const host = desktopGitHost(alias, 'device'), place = await host.place('git', '');
		expect(await host.loadDevice(place.cwd, path.join(place.cwd, '.git/nand-sync.json'))).toEqual(EMPTY_DEVICE_STATE);
		await host.saveDevice(place.cwd, EMPTY_DEVICE_STATE, { ...EMPTY_DEVICE_STATE, paused: 'manual' });
		expect(JSON.parse(await readFile(path.join(real, syncStatePath(real, real, 'device')), 'utf8')).paused).toBe('manual');
		await expect(host.loadDevice(root, path.join(root, 'nand-sync.json'))).rejects.toThrow('invalid-repository');
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
