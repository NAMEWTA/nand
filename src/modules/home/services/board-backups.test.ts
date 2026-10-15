import { expect, test, vi } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import type { HomeHost } from './home-host';
import { DEFAULT_DASHBOARD_SETTINGS } from '../core/board/types';
import { backupBoards, restoreLatestBackup, startBoardBackups, BACKUP_ROOT } from './board-backups';
function fixture() {
	const vault = memoryVault(
			{
				'.nand/content/dashboard.md': '# Board',
				'.nand/content/NAND/习惯/habits.json': '{"version":1,"habits":[]}',
			},
			{},
		),
		flush = vi.fn(async () => {}),
		reload = vi.fn(async () => {}),
		setInterval = vi.fn(() => 7),
		clearInterval = vi.fn();
	const settings = {
		...structuredClone(DEFAULT_DASHBOARD_SETTINGS),
		dashboardFile: '.nand/content/dashboard',
		backupMaxCount: 2,
		backupLastRun: 0,
	};
	Object.assign(vault.app.workspace, {
		containerEl: { ownerDocument: { defaultView: { setInterval, clearInterval } } },
	});
	const host = {
		app: vault.app,
		settings,
		boardSurfaces: () => [{ sync: { flush } }],
		reloadAllDashboards: reload,
		updateSettings: async (fn: (s: typeof settings) => void) => fn(settings),
	} as unknown as HomeHost;
	return { vault, host, flush, reload, setInterval, clearInterval };
}
test('Apex backup groups include board and records, prune together, and serialize concurrent clicks', async () => {
	const f = fixture();
	await Promise.all([backupBoards(f.host), backupBoards(f.host), backupBoards(f.host)]);
	const paths = [...f.vault.contents.keys()].filter((p) => p.startsWith(BACKUP_ROOT));
	expect(paths).toHaveLength(6);
	expect(paths.filter((p) => p.includes('/dashboard-'))).toHaveLength(2);
	expect(paths.filter((p) => p.endsWith('-habits.json'))).toHaveLength(2);
	expect(f.flush).toHaveBeenCalledTimes(3);
});
test('restore recreates the active board and never uses paths from snapshot content', async () => {
	const f = fixture();
	await backupBoards(f.host);
	f.vault.contents.delete('.nand/content/dashboard.md');
	await restoreLatestBackup(f.host);
	expect(f.vault.contents.get('.nand/content/dashboard.md')).toBe('# Board');
	expect(f.reload).toHaveBeenCalledOnce();
});
test('failed snapshot removes its incomplete group and leaves last-run unchanged', async () => {
	const f = fixture();
	const write = vi.spyOn(f.vault.adapter, 'write');
	write.mockImplementation(async (path, text) => {
		if (path.endsWith('-habits.json.tmp')) throw Error('disk full');
		f.vault.contents.set(path, text);
	});
	await expect(backupBoards(f.host)).rejects.toThrow('disk full');
	expect([...f.vault.contents.keys()].filter((p) => p.startsWith(BACKUP_ROOT))).toEqual([]);
	expect(f.host.settings.backupLastRun).toBe(0);
});
test('disabled schedule performs no IO and releases the owner timer', () => {
	const f = fixture(),
		stop = startBoardBackups(f.host);
	expect(f.setInterval).toHaveBeenCalledOnce();
	stop();
	expect(f.clearInterval).toHaveBeenCalledWith(7);
	expect(f.flush).not.toHaveBeenCalled();
});

function manifests(f: ReturnType<typeof fixture>) {
	return [...f.vault.contents]
		.filter(([p]) => /snapshot-.*\.json$/.test(p))
		.map(([path, value]) => ({ path, ...JSON.parse(value) }));
}
test('restoration isolates boards and retains a verified pre-restore copy', async () => {
	const f = fixture();
	await backupBoards(f.host);
	f.host.settings.dashboardFile = '.nand/content/B';
	f.vault.contents.set('.nand/content/B.md', '# B important');
	await expect(restoreLatestBackup(f.host)).rejects.toThrow();
	expect(f.vault.contents.get('.nand/content/B.md')).toBe('# B important');
	await backupBoards(f.host);
	f.vault.contents.set('.nand/content/B.md', '# B newest');
	await restoreLatestBackup(f.host);
	expect(f.vault.contents.get('.nand/content/B.md')).toBe('# B important');
	const safety = manifests(f).find((m) => m.kind === 'before-restore');
	expect(safety.board).toBe('.nand/content/B.md');
	expect(f.vault.contents.get(`${BACKUP_ROOT}/${safety.files[0].name}`)).toBe('# B newest');
	expect(manifests(f).filter((m) => m.board === '.nand/content/dashboard.md')).toHaveLength(1);
});
test('snapshot and restore capture their target before queue/flush changes the active board', async () => {
	const f = fixture();
	f.vault.contents.set('.nand/content/B.md', '# B');
	f.flush.mockImplementation(async () => {
		f.host.settings.dashboardFile = '.nand/content/B';
	});
	await backupBoards(f.host);
	expect(manifests(f)[0].board).toBe('.nand/content/dashboard.md');
	f.host.settings.dashboardFile = '.nand/content/dashboard';
	f.vault.contents.set('.nand/content/dashboard.md', '# updated');
	await restoreLatestBackup(f.host);
	expect(f.vault.contents.get('.nand/content/dashboard.md')).toBe('# Board');
	expect(f.vault.contents.get('.nand/content/B.md')).toBe('# B');
});
test.each(['partial', 'empty', 'corrupt-success', 'cleanup-failure'])(
	'failed %s writes never publish a restorable group',
	async (mode) => {
		const f = fixture();
		await backupBoards(f.host);
		f.vault.contents.set('.nand/content/dashboard.md', '# newest important');
		const write = f.vault.adapter.write;
		vi.spyOn(f.vault.adapter, 'write').mockImplementation(async (path, text) => {
			if (path.endsWith('.md.tmp')) {
				f.vault.contents.set(path, mode === 'empty' ? '' : text.slice(0, 3));
				if (mode !== 'corrupt-success') throw Error('disk full');
			} else await write(path, text);
		});
		if (mode === 'cleanup-failure') vi.spyOn(f.vault.adapter, 'remove').mockRejectedValue(Error('locked'));
		await expect(backupBoards(f.host)).rejects.toThrow();
		expect(manifests(f).filter((m) => m.kind === 'backup')).toHaveLength(1);
		vi.restoreAllMocks();
		await restoreLatestBackup(f.host);
		expect(f.vault.contents.get('.nand/content/dashboard.md')).toBe('# Board');
	},
);
test('safety-copy failure prevents replacement, and corrupt committed snapshots are skipped', async () => {
	const f = fixture();
	await backupBoards(f.host);
	f.vault.contents.set('.nand/content/dashboard.md', '# second');
	await backupBoards(f.host);
	const latest = manifests(f).at(-1);
	f.vault.contents.set(`${BACKUP_ROOT}/${latest.files[0].name}`, '# partial');
	f.vault.contents.set('.nand/content/dashboard.md', '# current');
	vi.spyOn(f.vault.adapter, 'write').mockRejectedValueOnce(Error('disk full'));
	await expect(restoreLatestBackup(f.host)).rejects.toThrow('disk full');
	expect(f.vault.contents.get('.nand/content/dashboard.md')).toBe('# current');
	vi.restoreAllMocks();
	await restoreLatestBackup(f.host);
	expect(f.vault.contents.get('.nand/content/dashboard.md')).toBe('# Board');
});
