import { Notice, Platform } from 'obsidian';
import type { ModuleContext } from '../../../app/contracts/module';
import type { AppWithCommands } from '../../../host/obsidian/obsidian-internal';
import { deviceId as getDeviceId } from '../../../host/obsidian/storage/device-id';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
import { AutomationError, automationOutcome } from '../../../shared/automation/errors';
import { isActiveRun, type AutomationDefinition, type AutomationSourcePort, type SourceRef } from '../../../shared/automation/types';
import { t } from '../../../shared/i18n/index';
import { BROWSER_OPEN } from '../../browser/api';
import { AGENT_SESSIONS } from '../../agent/api';
import type { NotificationOpener, NotificationRequest } from '../../notifications/api';
import { AUTOMATION_AGENT_RUNTIME, AUTOMATION_SOURCES, AUTOMATION_WORKFLOW_RUNNERS, type AutomationSource, type AutomationWorkflowChoice, type AutomationWorkflowRunner } from '../api';
import { actionAvailability } from '../core/actions/executor';
import { AutomationService } from '../core/service';
import { MarkdownAutomationDefinitions } from '../platform/definitions';

export interface AutomationRuntime {
	readonly service: AutomationService;
	/** Opens the source or run an automation notification points at. */
	readonly opener: NotificationOpener;
	/** Active products that store definitions in their documents. */
	sources(): Promise<AutomationSource[]>;
	workflows(): Promise<AutomationWorkflowChoice[]>;
	workflowPages(): Promise<ReturnType<AutomationWorkflowRunner['pages']>>;
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
	const workflowRunner = async () => {
		const rows = await context.contributions.collect(AUTOMATION_WORKFLOW_RUNNERS);
		const runner = rows.length === 1 && rows[0]?.module === 'browser' ? rows[0].value : undefined;
		if (!runner || runner.revoked.aborted) throw new AutomationError('workflowUnavailable');
		return runner;
	};
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
		privateVaultStorage(app),
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
			attachMaterial: async (request, signal) => {
				if (request.destination.kind !== 'existing') throw new AutomationError('invalid');
				const sessionId = request.destination.sessionId;
				const sessions = context.services.peek(AGENT_SESSIONS);
				const target = (await sessions?.list())?.find(session => session.id === sessionId && session.agentId === request.agentId);
				if (!sessions || !target?.agentId) throw new AutomationError('sessionMissing');
				await sessions.attachMaterial(target.id, { title: '', text: request.finalPrompt, files: request.files }, { agentId: target.agentId, signal });
			},
			executor: {
				validate: async action => { if (action.kind === 'browser-workflow') await (await workflowRunner()).validate(action); },
				open: async run => { if (run.definition?.action.kind === 'browser-workflow') await (await workflowRunner()).open(run.id); },
				execute: async (action, execution) => {
					if (action.kind === 'browser-workflow') {
						const runner = await workflowRunner(), abort = new AbortController();
						const cancel = () => abort.abort(execution.signal.reason), revoked = () => abort.abort('module-disabled');
						const release = () => { execution.signal.removeEventListener('abort', cancel); runner.revoked.removeEventListener('abort', revoked); };
						execution.signal.addEventListener('abort', cancel, { once: true }); runner.revoked.addEventListener('abort', revoked, { once: true });
						try {
							if (execution.signal.aborted || runner.revoked.aborted) throw new AutomationError('workflowUnavailable');
							const handle = await runner.start(action, { runId: execution.run.id, trigger: execution.run.trigger, signal: abort.signal, authorizationId: execution.authorizationId });
							void handle.completion.catch(() => undefined);
							return { message: '', handle: { open: () => handle.open(), cancel: async () => { abort.abort('cancelled'); await handle.cancel(); }, completion: handle.completion.finally(release) } };
						} catch (error) { release(); throw error; }
					}
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
		workflows: async () => (await workflowRunner()).list(),
		workflowPages: async () => (await workflowRunner()).pages(),
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
