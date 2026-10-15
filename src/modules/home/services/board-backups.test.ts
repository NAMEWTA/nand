import { beforeEach, expect, test, vi } from 'vitest';
import type { HomeHost } from './home-host';
import { DEFAULT_DASHBOARD_SETTINGS } from '../core/board/types';
const { content, read, write, processFile, mkdir } = vi.hoisted(() => ({
	content: new Map<string, string>(),
	read: vi.fn(),
	write: vi.fn(),
	processFile: vi.fn(),
	mkdir: vi.fn(),
}));
vi.mock('../../../host/obsidian/storage/private-storage', () => ({
	privateVaultStorage: () => ({ mkdir, read, write }),
}));
vi.mock('../../../host/obsidian/storage/content-files', () => ({
	contentFiles: () => ({
		getFileByPath: (path: string) => (content.has(path) ? { path } : null),
		read: async (file: { path: string }) => content.get(file.path),
		process: processFile,
	}),
}));
import { backupBoards, restoreLatestBackup, startBoardBackups } from './board-backups';
beforeEach(() => {
	vi.clearAllMocks();
	content.clear();
	processFile.mockImplementation(async (path: string, fn: (raw: string | null) => string) =>
		content.set(path, fn(content.get(path) ?? null)),
	);
});
function host() {
	const settings = {
		...structuredClone(DEFAULT_DASHBOARD_SETTINGS),
		workspaces: { files: ['.nand/content/dashboard'], names: [''], active: 0 },
		backupMaxCount: 2,
	};
	const remove = vi.fn(),
		list = vi.fn(async () => ({
			files: [
				'.nand/recovery/dashboard/backups/100.json',
				'.nand/recovery/dashboard/backups/200.json',
				'.nand/recovery/dashboard/backups/300.json',
			],
			folders: [],
		}));
	const flush = vi.fn(async () => {}),
		reload = vi.fn(async () => {}),
		setInterval = vi.fn((callback: () => void) => {
			void callback;
			return 7;
		}),
		clearInterval = vi.fn();
	const host = {
		settings,
		boardSurfaces: () => [{ sync: { flush } }],
		updateSettings: async (fn: (s: typeof settings) => void) => fn(settings),
		reloadAllDashboards: reload,
		app: {
			vault: { adapter: { list, remove, exists: async () => true } },
			workspace: { containerEl: { ownerDocument: { defaultView: { setInterval, clearInterval } } } },
		},
	} as unknown as HomeHost;
	return { host, remove, flush, reload, setInterval, clearInterval };
}
test('backup flushes board writes and prunes only backup files beyond retention', async () => {
	const env = host();
	content.set('.nand/content/dashboard.md', '# Board');
	await backupBoards(env.host);
	expect(env.flush).toHaveBeenCalledOnce();
	expect(write).toHaveBeenCalledOnce();
	expect(JSON.parse(write.mock.calls[0]![1])).toEqual({
		version: 1,
		boards: { '.nand/content/dashboard.md': '# Board' },
	});
	expect(env.remove).toHaveBeenCalledExactlyOnceWith('.nand/recovery/dashboard/backups/100.json');
});
test('restore only writes configured board paths and reloads the board after persistence', async () => {
	const env = host();
	read.mockResolvedValue(
		JSON.stringify({
			version: 1,
			boards: {
				'.nand/content/dashboard.md': '# Restored',
				'Private.md': 'must not write',
				'../outside.md': 'no',
			},
		}),
	);
	await restoreLatestBackup(env.host);
	expect(processFile).toHaveBeenCalledOnce();
	expect(content.get('.nand/content/dashboard.md')).toBe('# Restored');
	expect(content.has('Private.md')).toBe(false);
	expect(env.reload).toHaveBeenCalledOnce();
});
test('disabled backup timers perform no IO and are disposed in the owning window', () => {
	const env = host(),
		stop = startBoardBackups(env.host);
	const callback = env.setInterval.mock.calls[0]?.[0] as unknown as () => void;
	callback();
	expect(write).not.toHaveBeenCalled();
	stop();
	expect(env.clearInterval).toHaveBeenCalledExactlyOnceWith(7);
});
