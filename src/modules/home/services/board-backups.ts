// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/backup-service.ts
import { t } from '../../../shared/i18n';
import type { HomeHost } from './home-host';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
import { contentFiles } from '../../../host/obsidian/storage/content-files';
const ROOT = '.nand/recovery/dashboard/backups';
export async function backupBoards(host: HomeHost): Promise<void> {
	await Promise.all(
		host.boardSurfaces().map(async (surface) => {
			await surface.sync.flush?.();
		}),
	);
	const storage = privateVaultStorage(host.app),
		files = contentFiles(host.app);
	await storage.mkdir(ROOT);
	const boards: Record<string, string> = {};
	for (const path of host.settings.workspaces.files) {
		const target = path.endsWith('.md') ? path : path + '.md',
			file = files.getFileByPath(target);
		if (file) boards[target] = await files.read(file);
	}
	const name = `${ROOT}/${Date.now()}.json`;
	await storage.write(name, JSON.stringify({ version: 1, boards }));
	const listed = await host.app.vault.adapter.list(ROOT);
	for (const old of listed.files
		.filter((f) => /\/\d+\.json$/.test(f))
		.sort()
		.slice(0, -Math.max(1, host.settings.backupMaxCount)))
		await host.app.vault.adapter.remove(old);
	await host.updateSettings((s) => {
		s.backupLastRun = Date.now();
	});
}
export async function restoreLatestBackup(host: HomeHost): Promise<void> {
	const storage = privateVaultStorage(host.app);
	if (!(await host.app.vault.adapter.exists(ROOT))) throw new Error(t('home.p1.noBackup'));
	await Promise.all(
		host.boardSurfaces().map(async (surface) => {
			await surface.sync.flush?.();
		}),
	);
	const list = await host.app.vault.adapter.list(ROOT),
		last = list.files
			.filter((f) => /\/\d+\.json$/.test(f))
			.sort()
			.at(-1);
	if (!last) throw new Error(t('home.p1.noBackup'));
	const raw: unknown = JSON.parse(await storage.read(last));
	if (!raw || typeof raw !== 'object' || !('boards' in raw) || !raw.boards || typeof raw.boards !== 'object')
		throw new Error(t('home.p1.invalidBackup'));
	const allowed = new Set(host.settings.workspaces.files.map((p) => (p.endsWith('.md') ? p : p + '.md')));
	for (const [path, text] of Object.entries(raw.boards)) {
		if (allowed.has(path) && typeof text === 'string') await contentFiles(host.app).process(path, () => text);
	}
	await host.reloadAllDashboards();
}

/** One module-owned timer; disabled backups perform no I/O. */
export function startBoardBackups(host: HomeHost): () => void {
	const win = host.app.workspace.containerEl.ownerDocument.defaultView;
	if (!win) return () => {};
	let busy = false,
		closed = false;
	const tick = () => {
		const settings = host.settings;
		if (
			closed ||
			busy ||
			!settings.backupEnabled ||
			Date.now() - (settings.backupLastRun ?? 0) < (settings.backupPeriod === 'weekly' ? 7 : 1) * 86400000
		)
			return;
		busy = true;
		void backupBoards(host)
			.catch((error) => console.error('[NAND dashboard backup]', error))
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
