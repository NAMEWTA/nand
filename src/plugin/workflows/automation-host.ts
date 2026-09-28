import { FileSystemAdapter, Notice } from 'obsidian';
import { AutomationService } from '../../core/automations/service';
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
import { NotificationInbox } from '../../view/notifications/inbox';
import { DashboardView } from '../../view/dashboard/view/dashboard-view';
import { DASHBOARD_VIEW_TYPE } from '../../view/dashboard/view/view-type';
import type DashboardPlugin from '../main';
import { CONTACTS_VIEW_TYPE, ContactsView } from '../modules/contacts/index';

/** Composition only: every source read/write stays in its owning product. */
export async function createAutomationHost(
	plugin: DashboardPlugin,
): Promise<AutomationUiPort & { dispose(): void; inbox(): void; service: AutomationService }> {
	const app = plugin.app;
	let deviceId: string = app.loadLocalStorage('nand.automation.device') as string;
	if (typeof deviceId !== 'string' || !deviceId) {
		deviceId = crypto.randomUUID();
		app.saveLocalStorage('nand.automation.device', deviceId);
	}
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
			if (source.kind === 'contacts') {
				await plugin.openContacts();
				const leaf = app.workspace.getLeavesOfType(CONTACTS_VIEW_TYPE)[0];
				await leaf?.loadIfDeferred();
				await plugin.contactsHost?.ensureLoaded();
				if (leaf?.view instanceof ContactsView) leaf.view.select(source.path);
			} else if (source.kind === 'widget') {
				const file = dashboard.resolveWidgetSource(source);
				await plugin.switchWorkspace(file.path);
				await plugin.openDashboard();
				const leaf = app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)[0];
				await leaf?.loadIfDeferred();
				if (leaf) await app.workspace.revealLeaf(leaf);
				if (!(leaf?.view instanceof DashboardView) || !(await leaf.view.focusWidget(source.id)))
					throw new AutomationError('widgetMissing');
			} else {
				const file = app.vault.getFileByPath(source.path);
				if (!file) throw new AutomationError('sourceMissing');
				await plugin.switchWorkspace(file.path);
				await plugin.openDashboard();
			}
		},
		createTask: (action, runId) => dashboard.createTask(action, runId),
	};
	const notifications = new NotificationService(
		app.vault.adapter,
		`.nand/notifications/${deviceId}.json`,
		(source) => sources.open(source),
		async (target) => {
			await open();
			const leaf = app.workspace.getLeavesOfType(AUTOMATION_VIEW_TYPE)[0];
			await leaf?.loadIfDeferred();
			if (leaf?.view instanceof AutomationView) leaf.view.showRun(target.runId);
		},
		createNotificationDelivery(app),
	);
	const service = new AutomationService(
		app.vault.adapter,
		`.nand/automation/${deviceId}.json`,
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
	const edit = (source?: SourceRef, title?: string, existing?: AutomationDefinition) => {
		if (service.loadError) {
			new Notice(t('automation.failedLoad'));
			return;
		}
		const current =
			existing ?? service.definitions.find((d) => source?.kind === 'dashboard' && d.source?.id === source.id);
		const cwd = app.vault.adapter instanceof FileSystemAdapter ? app.vault.adapter.getBasePath() : '';
		new AutomationEditor(app, service, () => dashboard.targets(), cwd, source, title, current).open();
	};
	const inbox = () => new NotificationInbox(app, notifications).open();
	plugin.registerView(
		AUTOMATION_VIEW_TYPE,
		(leaf) => new AutomationView(leaf, { service, retry, edit: (d) => edit(d?.source, d?.name, d), inbox }),
	);
	const open = async () => {
		let leaf = app.workspace.getLeavesOfType(AUTOMATION_VIEW_TYPE)[0];
		if (!leaf) {
			leaf = app.workspace.getLeaf('tab');
			await leaf.setViewState({ type: AUTOMATION_VIEW_TYPE, active: true });
		}
		await app.workspace.revealLeaf(leaf);
		app.workspace.setActiveLeaf(leaf, { focus: true });
	};
	plugin.addRibbonIcon('timer', t('automation.title'), () => {
		void open();
	});
	const bell = plugin.addRibbonIcon('bell', t('automation.inbox'), inbox);
	const updateUnread = () => {
		if (notifications.unread) bell.dataset.nandUnread = String(notifications.unread);
		else delete bell.dataset.nandUnread;
	};
	updateUnread();
	plugin.register(notifications.subscribe(updateUnread));
	const tick = () => {
		if (!app.workspace.layoutReady) return;
		void service.tick().catch((error) => {
			console.error('[NAND automation]', error);
		});
	};
	plugin.registerInterval(app.workspace.containerEl.win.setInterval(tick, 60_000));
	plugin.registerDomEvent(app.workspace.containerEl.win, 'focus', tick);
	let refreshTimer: number | undefined;
	plugin.registerEvent(
		app.vault.on('modify', (file) => {
			if (!file.path.endsWith('.md')) return;
			if (refreshTimer !== undefined) app.workspace.containerEl.win.clearTimeout(refreshTimer);
			refreshTimer = app.workspace.containerEl.win.setTimeout(() => {
				void service.refresh().catch(console.error);
			}, 500);
		}),
	);
	plugin.register(() => {
		if (refreshTimer !== undefined) app.workspace.containerEl.win.clearTimeout(refreshTimer);
	});
	app.workspace.onLayoutReady(tick);
	return {
		service,
		edit,
		open,
		inbox,
		dispose: () => {
			service.dispose();
			notifications.dispose();
		},
	};
}
