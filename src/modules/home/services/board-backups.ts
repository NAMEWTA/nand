// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/backup-service.ts
import { t } from '../../../shared/i18n';
import type { HomeHost } from './home-host';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
import { ensureDirectory } from '../../../shared/storage/durable-state';
import { contentFiles } from '../../../host/obsidian/storage/content-files';
import { homeServices } from './instances';
export const BACKUP_ROOT = '.nand/recovery/dashboard/backups';
const DATA_PATHS = ['习惯/habits.json', '记账/expense.json', '番茄钟/pomodoro.json', '阅读/reading.json'];
const PERIOD_MS = { hourly: 3600000, daily: 86400000, weekly: 7 * 86400000, monthly: 30 * 86400000 };
const queues = new WeakMap<HomeHost['app'], Promise<void>>();
function serial(host: HomeHost, work: () => Promise<void>): Promise<void> {
	const pending = (queues.get(host.app) ?? Promise.resolve()).catch(() => {}).then(work);
	queues.set(host.app, pending);
	void pending
		.finally(() => {
			if (queues.get(host.app) === pending) queues.delete(host.app);
		})
		.catch(() => {});
	return pending;
}
async function flush(host: HomeHost): Promise<void> {
	await Promise.all([
		...host.boardSurfaces().map((s) => s.sync.flush?.()),
		...[homeServices.habit, homeServices.expense, homeServices.pomodoro, homeServices.reading].map((service) =>
			service?.flush(),
		),
	]);
}
interface Snapshot {
	version: 1;
	board: string;
	kind: 'backup' | 'before-restore';
	files: Array<{ name: string; digest: string }>;
}
function boardPath(host: HomeHost): string {
	const path = host.settings.dashboardFile;
	return path.endsWith('.md') ? path : path + '.md';
}
async function digest(text: string): Promise<string> {
	return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}
/** Publish the manifest last. Uncommitted/legacy files are never restoration candidates. */
async function snapshot(
	host: HomeHost,
	board: string,
	kind: Snapshot['kind'],
	entries: Array<[string, string]>,
): Promise<void> {
	const disk = privateVaultStorage(host.app),
		adapter = host.app.vault.adapter;
	await ensureDirectory(disk, BACKUP_ROOT);
	let instant = Date.now(),
		stamp: string;
	do {
		stamp = new Date(instant++).toISOString().replace(/[:.]/g, '-');
	} while (
		(await disk.exists(`${BACKUP_ROOT}/snapshot-${stamp}.json`)) ||
		(await disk.exists(`${BACKUP_ROOT}/dashboard-${stamp}.md`))
	);
	const manifest: Snapshot = { version: 1, board, kind, files: [] };
	const planned: string[] = [];
	const publish = async (name: string, text: string) => {
		const target = `${BACKUP_ROOT}/${name}`,
			temporary = target + '.tmp';
		// Register before write: a rejecting adapter may already have created/truncated the file.
		planned.push(temporary, target);
		await disk.write(temporary, text);
		if ((await disk.read(temporary)) !== text) throw Error(t('backup.failed'));
		await adapter.rename(temporary, target);
		if ((await disk.read(target)) !== text) throw Error(t('backup.failed'));
	};
	try {
		for (const [suffix, text] of entries) {
			const name = suffix === 'md' ? `dashboard-${stamp}.md` : `data-${stamp}-${suffix}`;
			await publish(name, text);
			manifest.files.push({ name, digest: await digest(text) });
		}
		await publish(`snapshot-${stamp}.json`, JSON.stringify(manifest));
	} catch (error) {
		// Remove the commit marker first; leftover data after cleanup failure stays ineligible.
		for (const path of planned.reverse()) await adapter.remove(path).catch(() => {});
		throw error;
	}
}
async function committed(
	host: HomeHost,
	board: string,
): Promise<Array<{ path: string; manifest: Snapshot; text: string }>> {
	const disk = privateVaultStorage(host.app),
		result: Array<{ path: string; manifest: Snapshot; text: string }> = [];
	if (!(await disk.exists(BACKUP_ROOT))) return result;
	for (const path of (await host.app.vault.adapter.list(BACKUP_ROOT)).files.sort()) {
		const stamp = /^snapshot-([\dTZ-]+Z)\.json$/.exec(path.slice(BACKUP_ROOT.length + 1))?.[1];
		if (!path.startsWith(BACKUP_ROOT + '/') || !stamp) continue;
		try {
			const manifest = JSON.parse(await disk.read(path)) as Snapshot;
			if (
				manifest.version !== 1 ||
				manifest.board !== board ||
				manifest.kind !== 'backup' ||
				!Array.isArray(manifest.files)
			)
				continue;
			const allowed = new Set([
				`dashboard-${stamp}.md`,
				...DATA_PATHS.map((name) => `data-${stamp}-${name.split('/').at(-1)!}`),
			]);
			let text: string | undefined;
			for (const file of manifest.files) {
				if (!allowed.delete(file.name)) throw Error('Invalid snapshot file');
				const value = await disk.read(`${BACKUP_ROOT}/${file.name}`);
				if ((await digest(value)) !== file.digest) throw Error('Invalid snapshot digest');
				if (file.name === `dashboard-${stamp}.md`) text = value;
			}
			if (text !== undefined) result.push({ path, manifest, text });
		} catch {
			/* Keep corrupt or incomplete snapshots for manual recovery, never apply them. */
		}
	}
	return result;
}
/** Apex timestamped Markdown/record files plus a per-board verified commit manifest. */
export function backupBoards(host: HomeHost): Promise<void> {
	const board = boardPath(host); // Capture before either the queue or flush can change the active board.
	return serial(host, async () => {
		await flush(host);
		const disk = privateVaultStorage(host.app);
		if (!(await host.app.vault.adapter.exists(board))) throw Error(t('backup.failed'));
		const entries: Array<[string, string]> = [['md', await host.app.vault.adapter.read(board)]];
		for (const name of DATA_PATHS) {
			const source = `.nand/content/NAND/${name}`;
			if (await disk.exists(source)) entries.push([name.split('/').at(-1)!, await disk.read(source)]);
		}
		await snapshot(host, board, 'backup', entries);
		const groups = await committed(host, board);
		for (const group of groups.slice(0, -Math.max(1, host.settings.backupMaxCount))) {
			await host.app.vault.adapter.remove(group.path);
			for (const file of group.manifest.files) await host.app.vault.adapter.remove(`${BACKUP_ROOT}/${file.name}`);
		}
		await host.updateSettings((s) => {
			s.backupLastRun = Date.now();
		});
	});
}
/** Restore only this board; retain a verified, uniquely named current copy before replacement. */
export function restoreLatestBackup(host: HomeHost): Promise<void> {
	const board = boardPath(host);
	return serial(host, async () => {
		const latest = (await committed(host, board)).at(-1);
		if (!latest) throw Error(t('home.p1.noBackup'));
		await flush(host);
		const adapter = host.app.vault.adapter;
		const before = (await adapter.exists(board)) ? await adapter.read(board) : null;
		if (before !== null) await snapshot(host, board, 'before-restore', [['md', before]]);
		await contentFiles(host.app).process(board, (current) => {
			if (current !== before) throw Error(t('backup.failed'));
			return latest.text;
		});
		await host.reloadAllDashboards();
	});
}
/** One owner-window timer polls elapsed time; in-flight snapshots drain on disable. */
export function startBoardBackups(host: HomeHost): () => void {
	const win = host.app.workspace.containerEl.ownerDocument.defaultView;
	if (!win) return () => {};
	let busy = false,
		closed = false;
	const tick = () => {
		const s = host.settings;
		if (closed || busy || !s.backupEnabled || Date.now() - (s.backupLastRun ?? 0) < PERIOD_MS[s.backupPeriod])
			return;
		busy = true;
		void backupBoards(host)
			.catch((e) => console.error('[NAND dashboard backup]', e))
			.finally(() => {
				busy = false;
			});
	};
	const timer = win.setInterval(tick, 60000);
	return () => {
		closed = true;
		win.clearInterval(timer);
	};
}
