import { afterEach, expect, test, vi } from 'vitest';
import { FileSystemAdapter, Platform, type App } from 'obsidian';
import { privateVaultStorage } from './private-storage';
import { privateStorageIfDesktop } from '../../private-storage';
import { storageWriteQueue } from '../../../shared/storage/write-queue';

vi.mock('../../private-storage', () => ({ privateStorageIfDesktop: vi.fn() }));
vi.mock('../../desktop/private-mode', () => ({ privateTextStorage: (inner: unknown) => inner }));
afterEach(() => vi.restoreAllMocks());

test('only a desktop POSIX filesystem adapter enters the private storage port', () => {
	const adapter = Object.create(FileSystemAdapter.prototype) as FileSystemAdapter;
	adapter.getBasePath = () => '/vault';
	const app = { vault: { adapter } } as unknown as App;
	const port = { exists: vi.fn(), read: vi.fn(), write: vi.fn(), mkdir: vi.fn() };
	vi.mocked(privateStorageIfDesktop).mockReturnValue(port);
	const desktop = Platform.isDesktopApp;
	const windows = Platform.isWin;
	try {
		Platform.isDesktopApp = true;
		Platform.isWin = false;
		expect(privateVaultStorage(app)).toBe(port);
		expect(privateStorageIfDesktop).toHaveBeenCalledWith(adapter, '/vault');
		vi.mocked(privateStorageIfDesktop).mockClear();
		Platform.isDesktopApp = false;
		expect(privateVaultStorage(app)).toBe(adapter);
		Platform.isDesktopApp = true;
		Platform.isWin = true;
		expect(privateVaultStorage(app)).toBe(adapter);
		Platform.isWin = false;
		const virtual = { getBasePath: () => '/virtual' };
		expect(privateVaultStorage({ vault: { adapter: virtual } } as unknown as App)).toBe(virtual);
		expect(privateStorageIfDesktop).not.toHaveBeenCalled();
	} finally { Platform.isDesktopApp = desktop; Platform.isWin = windows; }
});

test('storage queues remain shared through the lazy private port', async () => {
	const { privateStorageIfDesktop: wrap } = await vi.importActual<typeof import('../../private-storage')>('../../private-storage');
	const inner = { exists: vi.fn(), read: vi.fn(), write: vi.fn(), mkdir: vi.fn() };
	expect(wrap(inner, '')).toBe(inner);
	const port = wrap(inner, '/vault');
	expect(wrap(inner, '/vault')).toBe(port);
	expect(storageWriteQueue(port)).toBe(storageWriteQueue(inner));
	await port.write('.nand/test.json', '{}');
	expect(inner.write).toHaveBeenCalledWith('.nand/test.json', '{}');
});
