import { FileSystemAdapter } from 'obsidian';
import type DashboardPlugin from './main';
import { AutomationService } from '../automation/service';
import { AutomationEditor } from '../automation/editor';
import { AUTOMATION_VIEW_TYPE, AutomationView } from '../automation/view/view';
import { NotificationService } from '../notifications/service';
import { NotificationInbox } from '../notifications/inbox';
import { DashboardAutomationSource } from '../dashboard-view/persist/automation';
import { listContactReminders } from '../contacts/reminders';
import type {
	AutomationDefinition,
	AutomationSourcePort,
	AutomationUiPort,
	SourceRef,
} from '../shared/automation/types';
import { t } from '../shared/i18n';

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
			else throw new Error(t('automation.invalid'));
		},
		remove: async (d) => {
			if (d.source?.kind === 'dashboard' || d.source?.kind === 'widget') await dashboard.save(d, true);
			else if (d.source?.kind === 'contacts' && plugin.contactsHost)
				await plugin.contactsHost.saveReminder(d, true);
			else throw new Error(t('automation.invalid'));
		},
		open: async (source) => {
			await app.workspace.openLinkText(source.path, '', false);
		},
		createTask: (action, runId) => dashboard.createTask(action, runId),
	};
	const notifications = new NotificationService(app, `.nand/notifications/${deviceId}.json`, (source) =>
		sources.open(source),
	);
	await notifications.load();
	const service = new AutomationService(
		app,
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
						: `${t(`automation.${run.status}`)}${run.message ? `: ${run.message.slice(0, 240)}` : ''}`,
				source: d.source,
				channels: d.channels,
			});
		},
	);
	await service.load();
	const edit = (source?: SourceRef, title?: string, existing?: AutomationDefinition) => {
		const current =
			existing ?? service.definitions.find((d) => source?.kind === 'dashboard' && d.source?.id === source.id);
		const cwd = app.vault.adapter instanceof FileSystemAdapter ? app.vault.adapter.getBasePath() : '';
		new AutomationEditor(app, service, () => dashboard.targets(), cwd, source, title, current).open();
	};
	const inbox = () => new NotificationInbox(app, notifications).open();
	plugin.registerView(
		AUTOMATION_VIEW_TYPE,
		(leaf) => new AutomationView(leaf, { service, edit: (d) => edit(d?.source, d?.name, d), inbox }),
	);
	const open = async () => {
		let leaf = app.workspace.getLeavesOfType(AUTOMATION_VIEW_TYPE)[0];
		if (!leaf) {
			leaf = app.workspace.getLeaf('tab');
			await leaf.setViewState({ type: AUTOMATION_VIEW_TYPE, active: true });
		}
		await app.workspace.revealLeaf(leaf);
	};
	plugin.addRibbonIcon('timer', t('automation.title'), () => {
		void open();
	});
	plugin.addRibbonIcon('bell', t('automation.inbox'), inbox);
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
