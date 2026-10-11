import { FileSystemAdapter, Notice } from 'obsidian';
import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import type { AutomationDefinition, SourceRef } from '../../shared/automation/types';
import { t } from '../../shared/i18n/index';
import { NOTIFICATION_INBOX, NOTIFICATION_OPENERS, type NotificationOpener, type NotificationRequest } from '../notifications/api';
import { AUTOMATIONS, AUTOMATION_INVOCATIONS, AUTOMATION_WORKFLOW_INVOCATIONS, type AutomationsService, type AutomationInvocations, type AutomationWorkflowInvocations } from './api';
import { AutomationError } from '../../shared/automation/errors';
import type { AutomationEditRequest } from './core/api';
import { createAutomationRuntime, type AutomationRuntime } from './services/runtime';
import { registerMessages } from '../../shared/i18n/index';
import { messages } from './i18n';
import { messages as automationStrings } from '../../shared/i18n/lazy/automation';
import { messages as commonStrings } from '../../shared/i18n/lazy/common';

registerMessages(automationStrings);
registerMessages(commonStrings);
registerMessages(messages);

/**
 * Automations module. Each activation creates a runtime (definitions, scheduler, run history, timers and
 * vault listeners); turning the module off stops owned runs and releases all of it. Run results go to the
 * notifications inbox, or to a plain notice while notifications are off.
 */
export default function createAutomationsModule(context: ModuleContext): ModuleInstance {
	const { app, shell } = context;
	let runtime: AutomationRuntime | undefined;
	const listeners = new Set<() => void>();
	/** The request the automations page shows when it navigates to `focusId: 'edit'`. */
	let pendingEdit: AutomationEditRequest | undefined;
	const report = (error: unknown) => new Notice(error instanceof Error ? error.message : String(error));

	const notify = async (request: NotificationRequest): Promise<void> => {
		const inbox = await context.services.acquire(NOTIFICATION_INBOX);
		if (inbox) return inbox.value.send(request);
		if (request.channels.length) new Notice(request.title === request.body ? request.title : `${request.title}\n${request.body}`);
	};

	/** Board quick actions: pin a definition to one of the boards a source offers. */
	const pin = async (definition: AutomationDefinition) => {
		const boards = (await runtime?.sources())?.find((source) => source.pin && source.pinTargets);
		if (!boards?.pin || !boards.pinTargets) return;
		const { pinActionModal } = await import('./ui/pin-action');
		pinActionModal(app, definition, boards.pinTargets(), (path) => boards.pin!(path, definition));
	};
	const edit = (source?: SourceRef, title?: string, existing?: AutomationDefinition) => {
		const current = runtime;
		if (!current?.service.executionEnabled) {
			new Notice(t('automation.moduleOff'));
			return;
		}
		if (current.service.loadError) {
			new Notice(t('automation.failedLoad'));
			return;
		}
		const definition = existing ?? current.service.definitions.find((row) => source?.kind === 'dashboard' && row.source?.id === source.id);
		pendingEdit = { source, title, existing: definition };
		void shell.open({ feature: 'automations', section: 'tasks', focusId: 'edit' }, app.workspace.getMostRecentLeaf()?.view.containerEl.win).catch(report);
	};
	const taskTargets = async () => (await (await runtime?.sources())?.find((item) => item.taskTargets)?.taskTargets?.()) ?? [];

	const api: AutomationsService = {
		get loadError() { return runtime?.service.loadError ?? ''; },
		activeRuns: () => runtime?.service.state.runs.filter((run) => run.status === 'running' || run.status === 'pending') ?? [],
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		actions: () => runtime?.actions() ?? [],
		runAction: async (id) => {
			if (!runtime) throw new AutomationError('moduleOff');
			await runtime.runAction(id);
		},
		stopAction: async (id) => { await runtime?.stopAction(id); },
		openAction: async (id) => { await runtime?.openAction(id); },
		edit,
		open: () => shell.open({ feature: 'automations' }),
	};
	const opener: NotificationOpener = {
		canOpen: (record) => !!runtime?.opener.canOpen(record),
		open: async (record) => { await runtime?.opener.open(record); },
	};
	const invocations: AutomationInvocations = {
		invoke: (request, options) => {
			if (!runtime) return Promise.reject(new AutomationError('moduleOff'));
			return runtime.service.invokeAgent(request, options?.signal);
		},
		receipt: id => {
			const receipt = runtime?.service.state.runs.find(run => run.invocation?.request.invocationId === id)?.invocation?.receipt;
			return receipt ? structuredClone(receipt) : undefined;
		},
	};
	const workflows: AutomationWorkflowInvocations = {
		invoke: (request, options) => {
			if (!runtime) return Promise.reject(new AutomationError('moduleOff'));
			return runtime.service.invokeWorkflow(request, options);
		},
		receipt: id => runtime?.service.workflowReceipt(id),
		cancel: async id => {
			const run = runtime?.service.state.runs.find(row => row.id === id);
			if (run) await runtime?.service.stop(run);
		},
		open: async id => {
			const run = runtime?.service.state.runs.find(row => row.id === id);
			if (run) await runtime?.service.openRun(run);
		},
	};

	return {
		services: [[AUTOMATIONS, api], [AUTOMATION_INVOCATIONS, invocations], [AUTOMATION_WORKFLOW_INVOCATIONS, workflows]],
		contributions: [[NOTIFICATION_OPENERS, opener]],
		pages: {
			automations: async () => (await import('./ui/workbench-page')).createAutomationsPage(() => runtime && {
				service: runtime.service,
				retry: runtime.retry,
				edit: (definition) => edit(definition?.source, definition?.name, definition),
				inbox: () => { void shell.open({ feature: 'notifications' }).catch(report); },
				pin,
				takeEdit: () => {
					const request = pendingEdit;
					pendingEdit = undefined;
					return request;
				},
				taskTargets,
				workflowSources: { workflows: () => runtime?.workflows() ?? Promise.reject(new AutomationError('workflowUnavailable')),
					pages: () => runtime?.workflowPages() ?? Promise.reject(new AutomationError('workflowUnavailable')) },
				cwd: app.vault.adapter instanceof FileSystemAdapter ? app.vault.adapter.getBasePath() : '',
			}, () => new Error(t('automation.failedLoad'))),
		},
		settingsPage: async () => (await import('./ui/settings-page')).automationsSettingsPage({
			tasks: () => { void shell.open({ feature: 'automations' }).catch(report); },
			inbox: () => { void shell.open({ feature: 'notifications' }).catch(report); },
		}),
		async activate() {
			try {
				runtime = await createAutomationRuntime(context, notify);
			} catch (error) {
				new Notice(t('automation.failedLoad'));
				throw error;
			}
			context.lifetime.register(runtime.service.subscribe(() => {
				for (const listener of [...listeners]) listener();
				shell.refresh();
			}));
		},
		async dispose(reason) {
			const current = runtime;
			runtime = undefined;
			listeners.clear();
			await current?.shutdown(reason);
		},
	};
}
