import { Notice, Platform } from 'obsidian';
import type { ModuleContext } from '../../../app/contracts/module';
import type { AppWithCommands } from '../../../host/obsidian/obsidian-internal';
import { deviceId as getDeviceId } from '../../../host/obsidian/storage/device-id';
import { AutomationError, automationOutcome } from '../../../shared/automation/errors';
import { isActiveRun, type AutomationDefinition, type AutomationSourcePort, type SourceRef } from '../../../shared/automation/types';
import { t } from '../../../shared/i18n/index';
import { BROWSER_OPEN } from '../../browser/api';
import type { NotificationOpener, NotificationRequest } from '../../notifications/api';
import { AUTOMATION_AGENT_RUNTIME, AUTOMATION_SOURCES, type AutomationSource } from '../api';
import { actionAvailability } from '../core/actions/executor';
import { AutomationService } from '../core/service';
import { MarkdownAutomationDefinitions } from '../platform/definitions';

export interface AutomationRuntime {
	readonly service: AutomationService;
	/** Opens the source or run an automation notification points at. */
	readonly opener: NotificationOpener;
	/** Active products that store definitions in their documents. */
	sources(): Promise<AutomationSource[]>;
	/** Re-read definitions and run history after a failed load. */
	readonly retry: () => Promise<void>;
	actions(): Array<{ id: string; name: string; status?: string; running: boolean; unavailable?: string }>;
	runAction(id: string): Promise<void>;
	stopAction(id: string): Promise<void>;
	openAction(id: string): Promise<void>;
	/** Stop admission and owned runs (`disabled`) or interrupt them (`unload`), then release storage. */
	shutdown(reason: 'disabled' | 'unload'): Promise<void>;
}

/**
 * One automations runtime per module activation. Definitions live in Markdown (`MarkdownAutomationDefinitions`)
 * and in the documents of contributing products; run history is per device. Timers and vault listeners
 * belong to the module lifetime, so turning the module off stops everything.
 */
export async function createAutomationRuntime(context: ModuleContext, notify: (request: NotificationRequest) => Promise<void>): Promise<AutomationRuntime> {
	const { app, shell } = context;
	const deviceId = getDeviceId(app);
	const definitions = new MarkdownAutomationDefinitions(app);
	const providers = async () => (await context.contributions.collect(AUTOMATION_SOURCES)).map((entry) => entry.value);
	const owner = async (kind: SourceRef['kind']) => (await providers()).find((provider) => provider.kinds.includes(kind));
	const sources: AutomationSourcePort = {
		list: async () => {
			// Archive indexing waits for layoutReady; activation must never wait for it.
			if (!app.workspace.layoutReady) return [];
			const results = await Promise.allSettled((await providers()).map((provider) => provider.list()));
			return results.flatMap((result) => {
				if (result.status === 'fulfilled') return result.value;
				console.error('[NAND source]', result.reason);
				return [];
			});
		},
		save: async (definition) => {
			const provider = definition.source && (await owner(definition.source.kind));
			if (!provider) throw new AutomationError('invalid');
			await provider.save(definition);
		},
		remove: async (definition) => {
			const provider = definition.source && (await owner(definition.source.kind));
			if (!provider) throw new AutomationError('invalid');
			await provider.save(definition, true);
		},
		open: async (source) => {
			// Capture the requesting window before any asynchronous lookup.
			const ownerWindow = app.workspace.getMostRecentLeaf()?.view.containerEl.win ?? app.workspace.containerEl.win;
			const provider = await owner(source.kind);
			if (!provider) throw new AutomationError(source.kind === 'widget' ? 'widgetModuleDisabled' : 'sourceMissing');
			await provider.open(source, ownerWindow);
		},
		createTask: async (action, runId) => {
			const provider = (await providers()).find((item) => item.createTask);
			if (!provider?.createTask) throw new AutomationError('sourceMissing');
			await provider.createTask(action, runId);
		},
	};
	const openRuns = (resourceId?: string) => shell.open({ feature: 'automations', section: 'runs', resourceId }, app.workspace.getMostRecentLeaf()?.view.containerEl.win);
	const opener: NotificationOpener = {
		canOpen: (record) => !!record.source || !!record.target,
		open: async (record) => {
			if (record.source) await sources.open(record.source);
			else if (record.target) await openRuns(record.target.runId);
		},
	};
	const service = new AutomationService(
		app.vault.adapter,
		`.nand/automation/${deviceId}/runtime.json`,
		deviceId,
		sources,
		() => context.services.peek(AUTOMATION_AGENT_RUNTIME),
		async (run, definition) => {
			if (definition.notifyOn === 'never' || (definition.notifyOn === 'failure' && run.status !== 'failed' && run.status !== 'interrupted')) return;
			const plainNotice = definition.action.kind === 'notify' && run.status === 'succeeded';
			await notify({
				id: run.id,
				title: definition.name,
				body: plainNotice && definition.action.kind === 'notify' ? definition.action.body : automationOutcome(run),
				presentation: plainNotice ? undefined : { kind: 'automation-run', status: run.status, message: run.message, errorCode: run.errorCode, errorParams: run.errorParams },
				source: definition.source,
				target: { runId: run.id, automationId: definition.id, terminalId: run.terminalId },
				channels: definition.channels,
			});
		},
		true,
		{
			definitions,
			desktop: Platform.isDesktopApp,
			executor: {
				execute: async (action) => {
					if (action.kind === 'open-file') {
						if (!app.vault.getFileByPath(action.path)) throw new AutomationError('sourceMissing');
						await app.workspace.openLinkText(action.path, '', true);
					} else if (action.kind === 'open-url') {
						const browser = await context.services.acquire(BROWSER_OPEN);
						if (browser) await browser.value.open({ url: action.url, target: 'tab' });
						else app.workspace.containerEl.win.open(action.url, '_blank');
					} else if (action.kind === 'obsidian-command') {
						const commands = (app as AppWithCommands).commands;
						if (!commands.commands[action.command]) throw new AutomationError('invalid');
						commands.executeCommandById(action.command);
						return { message: t('automation.invoked') };
					} else throw new AutomationError('invalid');
					return { message: '' };
				},
			},
		},
	);
	const retry = async () => {
		try {
			await service.load();
		} catch (error) {
			service.loadError = String(error);
			new Notice(t('automation.failedLoad'));
		}
	};
	await retry();

	const win = app.workspace.containerEl.win;
	const tick = () => {
		if (!app.workspace.layoutReady) return;
		void service.tick().catch((error) => console.error('[NAND automation]', error));
	};
	context.lifetime.registerInterval(win.setInterval(tick, 60_000));
	context.lifetime.registerDomEvent(win, 'focus', tick);
	let refreshTimer: number | undefined;
	const changed = (file: { path: string }) => {
		if (!file.path.endsWith('.md')) return;
		if (refreshTimer !== undefined) win.clearTimeout(refreshTimer);
		refreshTimer = win.setTimeout(() => { void service.refresh().catch(console.error); }, 500);
	};
	context.lifetime.registerEvent(app.vault.on('modify', changed));
	context.lifetime.registerEvent(app.vault.on('create', changed));
	context.lifetime.registerEvent(app.vault.on('delete', changed));
	context.lifetime.registerEvent(app.vault.on('rename', (file, old) => { changed({ path: old }); changed(file); }));
	context.lifetime.register(() => { if (refreshTimer !== undefined) win.clearTimeout(refreshTimer); });
	app.workspace.onLayoutReady(tick);

	const latestRun = (id: string, filter: (run: (typeof service.state.runs)[number]) => boolean = () => true) =>
		[...service.state.runs].reverse().find((run) => run.automationId === id && filter(run));
	return {
		service,
		opener,
		sources: providers,
		retry,
		actions: () => service.definitions.map((definition: AutomationDefinition) => {
			const run = latestRun(definition.id);
			const reason = !service.executionEnabled ? 'automation.moduleOff' : definition.deviceId !== service.deviceId ? 'automation.otherDevice' : actionAvailability(definition.action.kind, 'manual', Platform.isDesktopApp);
			return { id: definition.id, name: definition.name, status: run?.status, running: !!run && isActiveRun(run), unavailable: reason ? t(reason) : undefined };
		}),
		runAction: async (id) => {
			await service.refresh();
			const definition = service.definitions.find((row) => row.id === id);
			if (!definition) throw new Error(t('automation.missingAction'));
			await service.run(definition);
		},
		stopAction: async (id) => {
			const run = service.state.runs.find((row) => row.automationId === id && isActiveRun(row));
			if (run) await service.stop(run);
		},
		openAction: async (id) => {
			const run = latestRun(id, (row) => !!row.terminalId);
			if (run?.terminalId && isActiveRun(run)) await service.agent()?.open(run.terminalId);
			else {
				const last = latestRun(id);
				await shell.open({ feature: 'automations', section: last ? 'runs' : 'tasks', resourceId: last?.id }, app.workspace.getMostRecentLeaf()?.view.containerEl.win);
			}
		},
		shutdown: async (reason) => {
			try {
				if (reason === 'disabled') await service.setExecutionEnabled(false);
				await service.shutdown();
			} finally {
				await definitions.shutdown();
			}
		},
	};
}
