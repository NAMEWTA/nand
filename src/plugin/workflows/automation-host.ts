import type { AutomationViewHost } from '../../view/automations/panel-contract';
import { FileSystemAdapter, Notice, Platform } from 'obsidian';
import { MarkdownAutomationDefinitions } from '../../platform/obsidian/automations/definitions';
import { deviceId as getDeviceId } from '../../platform/obsidian/storage/device-id';
import type { AppWithCommands } from '../../platform/obsidian/obsidian-internal';
import { AutomationService } from '../../core/automations/service';
import { actionAvailability } from '../../core/actions/executor';
import { isActiveRun } from '../../shared/automation/types';
import { pinActionModal } from '../../view/automations/pin-action';
import { NotificationService } from '../../core/notifications/service';
import { listContactReminders } from '../../platform/obsidian/contacts/reminders-source';
import { DashboardAutomationSource } from '../../platform/obsidian/dashboard/automation';
import { createNotificationDelivery } from '../../platform/obsidian/notifications/delivery';
import { AutomationError, automationOutcome } from '../../shared/automation/errors';
import type {
	AutomationDefinition,
	AutomationSourcePort,
	AutomationUiPort,
	SourceRef,
} from '../../shared/automation/types';
import { t } from '../../shared/i18n/index';
import { AutomationEditor } from '../../view/automations/editor';
import { AUTOMATION_VIEW_TYPE, AutomationView } from '../../view/automations/view';
import type DashboardPlugin from '../main';

/** Composition only: every source read/write stays in its owning product. */
export async function createAutomationHost(
	plugin: DashboardPlugin,
): Promise<AutomationUiPort & { dispose(): void; inbox(): void; service: AutomationService; panelHost: AutomationViewHost; notifications: NotificationService; setExecutionEnabled(enabled: boolean): Promise<void> }> {
	const app = plugin.app;
	const deviceId = getDeviceId(app);
	const definitions = new MarkdownAutomationDefinitions(app);
	const dashboard = new DashboardAutomationSource(
		app,
		() => plugin.settings,
		deviceId,
		() => plugin.saveSettings(),
		() => plugin.settings.modules.dashboard,
	);
	const sources: AutomationSourcePort = {
		list: async () => {
			// Contacts indexing waits for layoutReady; plugin.onload must never wait for it.
			if (!app.workspace.layoutReady) return [];
			const results = await Promise.allSettled([dashboard.list(), listContactReminders(plugin.contactsHost)]);
			return results.flatMap((result) => {
				if (result.status === 'fulfilled') return result.value;
				console.error('[NAND source]', result.reason);
				return [];
			});
		},
		save: async (d) => {
			if (d.source?.kind === 'dashboard' || d.source?.kind === 'widget') await dashboard.save(d);
			else if (d.source?.kind === 'contacts' && plugin.contactsHost) await plugin.contactsHost.saveReminder(d);
			else throw new AutomationError('invalid');
		},
		remove: async (d) => {
			if (d.source?.kind === 'dashboard' || d.source?.kind === 'widget') await dashboard.save(d, true);
			else if (d.source?.kind === 'contacts' && plugin.contactsHost)
				await plugin.contactsHost.saveReminder(d, true);
			else throw new AutomationError('invalid');
		},

		open: async (source) => {
			// Capture the requesting window before any asynchronous lookup.
			const ownerWindow = app.workspace.getMostRecentLeaf()?.view.containerEl.win ?? app.workspace.containerEl.win;
			if (source.kind === 'contacts') {
				await plugin.openWorkbench({ feature: 'contacts', resourceId: source.id || source.path }, ownerWindow);
			} else if (source.kind === 'widget') {
				const file = dashboard.resolveWidgetSource(source);
				await plugin.openWorkbench({ feature: 'dashboard', resourceId: file.path, focusId: source.id }, ownerWindow);
			} else {
				const file = app.vault.getFileByPath(source.path);
				if (!file) throw new AutomationError('sourceMissing');
				await plugin.openWorkbench({ feature: 'dashboard', resourceId: file.path }, ownerWindow);
			}
		},
		createTask: (action, runId) => dashboard.createTask(action, runId),
	};
	const notifications = new NotificationService(
		app.vault.adapter,
		`.nand/notifications/${deviceId}/inbox.json`,
		(source) => sources.open(source),
		(target) => plugin.openWorkbench({ feature: 'automations', section: 'runs', resourceId: target.runId }),
		createNotificationDelivery(app),
	);
	const service = new AutomationService(
		app.vault.adapter,
		`.nand/automation/${deviceId}/runtime.json`,
		deviceId,
		sources,
		() => (plugin.terminalHost?.isActive() ? plugin.terminalHost.getAutomationRuntime() : undefined),
		async (run, d) => {
			if (
				d.notifyOn === 'never' ||
				(d.notifyOn === 'failure' && run.status !== 'failed' && run.status !== 'interrupted')
			)
				return;
			await notifications.send({
				id: run.id,
				title: d.name,
				body:
					d.action.kind === 'notify' && run.status === 'succeeded'
						? d.action.body
						: automationOutcome(run),
				presentation: d.action.kind === 'notify' && run.status === 'succeeded' ? undefined : {
					kind: 'automation-run', status: run.status, message: run.message,
					errorCode: run.errorCode, errorParams: run.errorParams,
				},
				source: d.source,
				target: { runId: run.id, automationId: d.id, terminalId: run.terminalId },
				channels: d.channels,
			});
		},
		plugin.settings.modules.automation,
		{
			definitions, desktop: Platform.isDesktopApp,
			executor: { execute: async action => {
				if (action.kind === 'open-file') {
					if (!app.vault.getFileByPath(action.path)) throw new AutomationError('sourceMissing');
					await app.workspace.openLinkText(action.path, '', true);
				} else if (action.kind === 'open-url') await plugin.browserHost.open({ url: action.url, target: 'tab' });
				else if (action.kind === 'obsidian-command') {
					if (!(app as AppWithCommands).commands.commands[action.command]) throw new AutomationError('invalid');
					(app as AppWithCommands).commands.executeCommandById(action.command);
					return { message: t('automation.invoked') };
				} else throw new AutomationError('invalid');
				return { message: '' };
			} },
		},
	);
	const retry = async () => {
		try {
			await notifications.load();
			await service.load();
		} catch (error) {
			service.loadError = String(error);
			new Notice(t('automation.failedLoad'));
		}
	};
	await retry();
	const pin = async (definition: AutomationDefinition) => {
		pinActionModal(app, definition, [...new Set([plugin.settings.dashboardFile, ...plugin.settings.workspaceFiles])],
			path => dashboard.pinAction(path, definition));
	};
	const edit = (source?: SourceRef, title?: string, existing?: AutomationDefinition) => {
		if (!service.executionEnabled) {
			new Notice(t('automation.moduleOff'));
			return;
		}
		if (service.loadError) {
			new Notice(t('automation.failedLoad'));
			return;
		}
		const current =
			existing ?? service.definitions.find((d) => source?.kind === 'dashboard' && d.source?.id === source.id);
		const cwd = app.vault.adapter instanceof FileSystemAdapter ? app.vault.adapter.getBasePath() : '';
		new AutomationEditor(app, service, () => dashboard.targets(), cwd, source, title, current, pin).open();
	};
	const inbox = () => { void plugin.openWorkbench({ feature: 'notifications' }).catch((error: unknown) => new Notice(String(error))); };
	const panelHost: AutomationViewHost = { service, retry, edit: (d) => edit(d?.source, d?.name, d), inbox, pin };
	plugin.registerView(AUTOMATION_VIEW_TYPE, (leaf) => new AutomationView(leaf, panelHost));
	const open = () => plugin.openWorkbench({ feature: 'automations' });

	const tick = () => {
		if (!app.workspace.layoutReady) return;
		void service.tick().catch((error) => {
			console.error('[NAND automation]', error);
		});
	};
	plugin.registerInterval(app.workspace.containerEl.win.setInterval(tick, 60_000));
	plugin.registerDomEvent(app.workspace.containerEl.win, 'focus', tick);
	let refreshTimer: number | undefined;
	const changed = (file: { path: string }) => {
		dashboard.invalidate(file.path);
		if (!file.path.endsWith('.md')) return;
		if (refreshTimer !== undefined) app.workspace.containerEl.win.clearTimeout(refreshTimer);
		refreshTimer = app.workspace.containerEl.win.setTimeout(() => { void service.refresh().catch(console.error); }, 500);
	};
	plugin.registerEvent(app.vault.on('modify', changed));
	plugin.registerEvent(app.vault.on('create', changed));
	plugin.registerEvent(app.vault.on('delete', changed));
	plugin.registerEvent(app.vault.on('rename', (file, old) => { changed({ path: old }); changed(file); }));
	plugin.register(() => {
		if (refreshTimer !== undefined) app.workspace.containerEl.win.clearTimeout(refreshTimer);
	});
	app.workspace.onLayoutReady(tick);
	return {
		service, panelHost, notifications,
		subscribe: listener => service.subscribe(listener),
		actions: () => service.definitions.map(definition => {
			const run = [...service.state.runs].reverse().find(row => row.automationId === definition.id);
			const reason = !service.executionEnabled ? 'automation.moduleOff' : definition.deviceId !== service.deviceId ? 'automation.otherDevice' : actionAvailability(definition.action.kind, 'manual', Platform.isDesktopApp);
			return { id: definition.id, name: definition.name, status: run?.status, running: !!run && isActiveRun(run), unavailable: reason ? t(reason) : undefined };
		}),
		runAction: async id => {
			await service.refresh();
			const definition = service.definitions.find(row => row.id === id);
			if (!definition) throw new Error(t('automation.missingAction'));
			await service.run(definition);
		},
		stopAction: async id => {
			const run = service.state.runs.find(row => row.automationId === id && isActiveRun(row));
			if (run) await service.stop(run);
		},
		openAction: async id => {
			const run = [...service.state.runs].reverse().find(row => row.automationId === id && row.terminalId);
			if (run?.terminalId && isActiveRun(run)) await service.agent()?.open(run.terminalId);
			else await plugin.openWorkbench({ feature: 'automations', section: run ? 'runs' : 'tasks', resourceId: run?.id }, app.workspace.getMostRecentLeaf()?.view.containerEl.win);
		},
		setExecutionEnabled: async (enabled) => {
			const wasEnabled = service.executionEnabled;
			await service.setExecutionEnabled(enabled);
			if (enabled && !wasEnabled) tick();
		},
		edit,
		open,
		inbox,
		dispose: () => {
			void service.shutdown().finally(() => definitions.shutdown()).catch(console.error);
			void notifications.shutdown().catch(console.error);
		},
	};
}
