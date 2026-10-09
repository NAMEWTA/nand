import { FileSystemAdapter, Notice, TFile } from 'obsidian';
import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { registerMessages, t } from '../../shared/i18n/index';
import { messages as commonStrings } from '../../shared/i18n/lazy/common';
import { SYNC_WORKBENCH } from './api';
import { messages } from './i18n';
import { syncSettings } from './settings';
import type { Automatics } from './services/automatics';
import { describeReport } from './services/report';
import type { SyncService } from './services/sync-service';
import { syncWorkbench } from './services/workbench';

registerMessages(commonStrings);
registerMessages(messages);

/**
 * Git sync module (desktop). Activation finds git and the repository and starts automatic sync; turning the
 * module off stops timers, cancels queued work and kills running git processes. Nothing here prompts on unload.
 */
export default function createSyncModule(context: ModuleContext): ModuleInstance {
	const { app, shell } = context;
	const settings = context.settings.bind('sync', syncSettings);
	let service: SyncService | undefined;
	let automatics: Automatics | undefined;
	const listeners = new Set<() => void>();
	const changed = () => {
		for (const listener of [...listeners]) listener();
		shell.refresh();
	};
	const report = (error: unknown) => new Notice(error instanceof Error ? error.message : String(error));
	const workbench = syncWorkbench(() => service, (listener) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	});
	const repoFolder = () => settings.get().repoSubPath.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
	const openSettings = () => void shell.open({ feature: 'settings', section: 'sync' }).catch(report);
	const run = (work: (current: SyncService) => Promise<unknown>) => () => {
		if (!service) return void new Notice(t('sync.starting'));
		void work(service).catch(report);
	};
	/** The repository path of the active note, for the stage and unstage commands. */
	const activeRepoPath = (): string | null => {
		const file = app.workspace.getActiveFile();
		return file instanceof TFile ? service?.snapshot.place?.toRepo(file.path) ?? null : null;
	};

	return {
		services: [[SYNC_WORKBENCH, workbench]],
		pages: {
			sync: async () => (await import('./ui/workbench-page')).createSyncPage({ service: () => service, repoFolder, openSettings, report }),
		},
		settingsPage: async () => (await import('./ui/settings-page')).syncSettingsPage(settings, () => service),
		async activate() {
			const adapter = app.vault.adapter;
			if (!(adapter instanceof FileSystemAdapter)) throw new Error(t('sync.desktopOnly'));
			const [{ desktopGitHost }, { SyncService: Service }, { Automatics: Clock }, { syncDialogs }] = await Promise.all([
				import('./platform/desktop/host'),
				import('./services/sync-service'),
				import('./services/automatics'),
				import('./ui/dialogs'),
			]);
			const current = new Service({
				host: desktopGitHost(adapter.getBasePath()),
				settings,
				dialogs: syncDialogs(app),
				notify: (text, error) => void new Notice(text, error ? 10_000 : 5_000),
				describe: describeReport,
			});
			service = current;
			const win = app.workspace.containerEl.win;
			const clock = new Clock(current, settings, win);
			automatics = clock;
			context.lifetime.register(current.subscribe(changed));
			context.lifetime.register(current.onDeviceChange(() => clock.schedule()));
			context.lifetime.register(settings.subscribe(() => clock.schedule()));
			const fileEvent = () => {
				if (current.writingFiles) return;
				clock.fileChanged();
				current.refreshSoon(win);
			};
			for (const name of ['modify', 'create', 'delete', 'rename'] as const) context.lifetime.registerEvent(app.vault.on(name as 'modify', fileEvent));
			await current.connect();
			clock.start();

			const command = (id: string, nameKey: string, callback: () => void) => context.commands.add({ id, name: t(nameKey), nameKey, callback });
			command('sync-commit-and-sync', 'sync.cmd.commitAndSync', run((s) => s.commitAndSync('all')));
			command('sync-commit-and-sync-staged', 'sync.cmd.commitStagedAndSync', run((s) => s.commitAndSync('staged')));
			command('sync-commit', 'sync.cmd.commit', run((s) => s.commit('smart')));
			command('sync-commit-staged', 'sync.cmd.commitStaged', run((s) => s.commit('staged')));
			command('sync-commit-all', 'sync.cmd.commitAll', run((s) => s.commit('all')));
			command('sync-pull', 'sync.cmd.pull', run((s) => s.pull()));
			command('sync-push', 'sync.cmd.push', run((s) => s.push()));
			command('sync-fetch', 'sync.cmd.fetch', run((s) => s.fetch()));
			command('sync-pause-toggle', 'sync.cmd.pause', run((s) => s.setPaused(!s.snapshot.device.paused).then(() => new Notice(s.snapshot.device.paused ? t('sync.paused') : t('sync.resumed')))));
			command('sync-open', 'sync.cmd.open', () => void shell.open({ feature: 'sync', section: 'changes' }).catch(report));
			context.commands.add({
				id: 'sync-stage-current-file',
				name: t('sync.cmd.stageCurrent'),
				nameKey: 'sync.cmd.stageCurrent',
				checkCallback: (checking) => {
					const path = activeRepoPath();
					if (!path || !service) return false;
					if (!checking) void service.stage([path]).catch(report);
					return true;
				},
			});
			context.commands.add({
				id: 'sync-unstage-current-file',
				name: t('sync.cmd.unstageCurrent'),
				nameKey: 'sync.cmd.unstageCurrent',
				checkCallback: (checking) => {
					const path = activeRepoPath();
					if (!path || !service) return false;
					if (!checking) void service.unstage([path]).catch(report);
					return true;
				},
			});
			const { conflictExtension } = await import('./ui/conflict-extension');
			context.editor.addExtension(conflictExtension());
		},
		async dispose() {
			automatics?.stop();
			automatics = undefined;
			const current = service;
			service = undefined;
			listeners.clear();
			await current?.dispose();
		},
	};
}
