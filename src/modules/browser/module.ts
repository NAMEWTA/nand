import { Notice } from 'obsidian';
import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { registerMessages, t } from '../../shared/i18n';
import { AGENT_DIRECTORY, AGENT_DISPATCH, AGENT_PROMPT_RUNNER, AGENT_RUN_CONTEXTS, AGENT_SESSIONS, type AgentRunContextProvider } from '../agent/api';
import { BROWSER_AGENT_BRIDGE, BROWSER_ASSISTANT, BROWSER_CONTROL, BROWSER_OPEN, BROWSER_PROFILES, BROWSER_WORKSPACE, type BrowserAgentBridge, type BrowserAssistant, type BrowserControl, type BrowserOpener, type BrowserProfiles, type BrowserWorkspace } from './api';
import { BrowserError, newPageState, type BrowserAgentDeliveryPort } from './core/model';
import { browserError } from './core/text';
import { BrowserModule } from './services';
import type { BrowserWorkbenchPort } from './services/workbench-port';
import { browserSettings } from './settings';
import { messages as browserStrings } from '../../shared/i18n/lazy/browser';
import { messages as profileStrings } from './i18n';
import { AUTOMATION_SOURCES, AUTOMATION_WORKFLOW_INVOCATIONS, AUTOMATION_WORKFLOW_RUNNERS, type AutomationSource, type AutomationWorkflowRunner } from '../automations/api';
import { BROWSER_WORKFLOWS, BROWSER_EXTERNAL_ACCESS, type BrowserWorkflowService, type BrowserExternalAccess } from './api';
import { AutomationError } from '../../shared/automation/errors';

registerMessages(browserStrings);
registerMessages(profileStrings);

/**
 * Browser module: one browser host per activation (guests, history, permissions and the agent bridge).
 * Pages live in the workbench; turning the module off closes every guest and the bridge.
 */
export default function createBrowserModule(context: ModuleContext): ModuleInstance {
	const { app, shell } = context;
	const settings = context.settings.bind('browser', browserSettings);
	let host: BrowserModule | undefined;
	const workflowLifetime = new AbortController();
	const current = () => {
		if (!host) throw new BrowserError('browser_disabled');
		return host;
	};
	const workbench: BrowserWorkbenchPort = {
		open: (state, ownerWindow) => shell.open({ feature: 'browser', resourceId: state.id }, ownerWindow, { ...state }),
		openTab: (state, ownerWindow) => shell.openFocus({ feature: 'browser', resourceId: state.id }, { ...state }, ownerWindow),
		openTask: (taskId, ownerWindow) => shell.open({ feature: 'browser', section: 'multi-ai', resourceId: taskId }, ownerWindow),
		openAssistant: (taskId, ownerWindow) => shell.open({ feature: 'browser', section: 'assistant', resourceId: taskId }, ownerWindow),
		openWorkflows: (id, ownerWindow) => shell.open({ feature: 'browser', section: 'workflows', resourceId: id }, ownerWindow),
		openAccess: ownerWindow => shell.open({ feature: 'browser', section: 'access' }, ownerWindow),
		list: () => shell.savedPages('browser').flatMap((page) => (!page.target.section && page.target.resourceId ? [newPageState(page.target.resourceId, page.state)] : [])),
		activate: (id) => shell.activateResource('browser', id),
		close: (id) => shell.closeResource('browser', id),
	};
	// Material goes only to agent sessions that exist right now; the browser never starts the agent module.
	const agents: BrowserAgentDeliveryPort = {
		list: async () => (await context.services.peek(AGENT_SESSIONS)?.list()) ?? [],
		attach: async (sessionId, text, files) => {
			const sessions = context.services.peek(AGENT_SESSIONS);
			if (!sessions) throw new BrowserError('browser_agent_unavailable');
			await sessions.attachMaterial(sessionId, { title: t('browser.contextMaterial'), text, files });
		},
	};
	const opener: BrowserOpener = {
		open: async (request) => {
			try {
				return await current().open(request);
			} catch (error) {
				throw new Error(browserError(error));
			}
		},
		show: async (request) => {
			try {
				if (!request.url && !request.target) await shell.open({ feature: 'browser' });
				else await current().open(request);
			} catch (error) {
				new Notice(browserError(error));
			}
		},
	};
	const bridge: BrowserAgentBridge = { environment: () => host?.environment() ?? Promise.resolve({}) };
	const runContexts: AgentRunContextProvider = { id: 'browser', resolve: (...args) => host?.resolveScopedRun(...args) ?? Promise.resolve(undefined) };
	const control: BrowserControl = {
		list: () => current().control.list(),
		open: request => current().control.open(request),
		observe: target => current().control.observe(target),
		readElement: (target, ref) => current().control.readElement(target, ref),
		screenshot: (target, full) => current().control.screenshot(target, full),
		act: (target, action) => current().control.act(target, action),
		reviewAction: (target, action) => current().control.reviewAction(target, action),
		actReviewed: (target, id) => current().control.actReviewed(target, id),
		activate: target => current().control.activate(target),
		close: target => current().control.close(target),
	};
	const profiles: BrowserProfiles = {
		list: () => current().profiles(),
		create: label => current().createProfile(label),
		rename: (id, label) => current().renameProfile(id, label),
		affectedPages: id => current().profilePages(id),
		remove: (id, pages) => current().removeProfile(id, pages),
		subscribe: listener => current().subscribe(listener),
	};
	const assistant: BrowserAssistant = {
		initialize: async () => { await current().getAssistant(); }, snapshot: () => current().peekAssistant()?.records(),
		review: async request => (await current().getAssistant()).review(request), start: async id => (await current().getAssistant()).start(id),
		busy: id => current().peekAssistant()?.busy(id) ?? false,
		stop: (id, reason) => current().peekAssistant()?.stop(id, reason), takeover: async (id, target) => (await current().getAssistant()).takeover(id, target),
		confirmation: id => current().peekAssistant()?.confirmation(id), decide: (id, reviewId, allowed) => {
			const service = current().peekAssistant(); if (!service) throw new BrowserError('browser_action_review_changed'); service.decide(id, reviewId, allowed);
		}, retrySave: async () => (await current().getAssistant()).retrySave(), subscribe: listener => current().subscribe(listener),
	};
	const workspace: BrowserWorkspace = {
		initialize: async () => { await current().getWorkspace(); },
		snapshot: () => current().workspaceSnapshot(),
		busy: taskId => current().workspaceBusy(taskId),
		createTask: (title, profileId, accountLabel, provider) => current().createWorkspaceTask(title, profileId, accountLabel, provider),
		addTarget: (taskId, provider, profileId, accountLabel) => current().addWorkspaceTarget(taskId, provider, profileId, accountLabel),
		removeTarget: (taskId, targetId) => current().removeWorkspaceTarget(taskId, targetId),
		updateTask: async (taskId, change) => (await current().getWorkspace()).updateTask(taskId, change),
		prepareTarget: async (taskId, targetId, newConversation) => (await current().getWorkspace()).prepareTarget(taskId, targetId, newConversation),
		checkTargets: async taskId => (await current().getWorkspace()).checkTargets(taskId),
		preview: async (taskId, templateIds, finalPrompt, onlyReady) => (await current().getWorkspace()).preview(taskId, templateIds, finalPrompt, onlyReady),
		send: async previewId => (await current().getWorkspace()).send(previewId),
		pause: taskId => current().pauseWorkspace(taskId),
		takeover: (taskId, targetId) => current().takeoverWorkspaceTarget(taskId, targetId),
		resume: async taskId => (await current().getWorkspace()).checkTargets(taskId),
		recollect: async exchangeId => (await current().getWorkspace()).recollect(exchangeId),
		previewRetry: async exchangeId => (await current().getWorkspace()).previewRetry(exchangeId),
		retrySend: async previewId => (await current().getWorkspace()).retrySend(previewId),
		followUp: async exchangeId => (await current().getWorkspace()).followUp(exchangeId),
		openAnswer: (exchangeId, captureId) => current().openWorkspaceAnswer(exchangeId, captureId),
		retrySave: async () => (await current().getWorkspace()).retrySave(),
		subscribe: listener => current().subscribe(listener),
	};
	const workflows: BrowserWorkflowService = {
		initialize: async () => { await current().getWorkflows(); }, definitions: () => current().peekWorkflows()?.definitions() ?? [], records: () => current().peekWorkflows()?.records() ?? [],
		save: async (spec, expected) => (await current().getWorkflows()).save(spec, expected), saveVerified: async id => (await current().getWorkflows()).saveVerified(id),
		review: async (id, inputs, scope) => (await current().getWorkflows()).review(id, inputs, scope), invoke: async id => (await current().getWorkflows()).invoke(id),
		pause: id => current().peekWorkflows()?.pause(id), resume: async id => (await current().getWorkflows()).resume(id),
		cancel: async id => (await current().getWorkflows()).cancel(id), subscribe: listener => current().subscribe(listener),
	};
	const access: BrowserExternalAccess = { list: () => current().peekGrants()?.list() ?? [],
		create: async request => (await current().getGrants()).create(request), revoke: id => current().peekGrants()?.revoke(id), subscribe: listener => current().subscribe(listener) };
	const workflowRunner: AutomationWorkflowRunner = {
		revoked: workflowLifetime.signal,
		pages: () => current().control.list().map(page => ({ pageId: page.target.pageId, profileId: page.target.profileId, title: page.title, url: page.url })),
		list: async () => (await current().getWorkflows()).definitions().map(spec => ({ id: spec.id, version: spec.version, title: spec.title,
			verified: !!spec.verification, variables: spec.variables, scope: spec.targetScope })),
		validate: async action => { try { await (await current().getWorkflows()).validate(action); } catch { throw new AutomationError('workflowInvalid'); } },
		start: async (action, run) => (await current().getWorkflows()).start(action, run), open: id => current().openWorkflows(id),
	};
	const workflowSource: AutomationSource = { kinds: ['browser-workflow'], list: async () => [],
		save: async () => { throw new AutomationError('invalid'); }, open: (source, win) => current().openWorkflows(source.id, win) };
	return {
		contributions: [[AGENT_RUN_CONTEXTS, runContexts], [AUTOMATION_WORKFLOW_RUNNERS, workflowRunner], [AUTOMATION_SOURCES, workflowSource]],
		services: [[BROWSER_OPEN, opener], [BROWSER_AGENT_BRIDGE, bridge], [BROWSER_PROFILES, profiles], [BROWSER_CONTROL, control], [BROWSER_WORKSPACE, workspace], [BROWSER_ASSISTANT, assistant], [BROWSER_WORKFLOWS, workflows], [BROWSER_EXTERNAL_ACCESS, access]],
		pages: {
			browser: async () => (await import('./ui/workbench-page')).createBrowserPage(current),
		},
		settingsPage: async () => (await import('./ui/settings-page')).browserSettingsPage(current, settings, opener),
		async activate() {
			host = new BrowserModule(app, () => settings.get(), agents, workbench, async (state, closed) => {
				const { BrowserModal } = await import('./ui/browser-modal');
				const modal = new BrowserModal(current(), state, closed);
				modal.open();
				return modal;
			});
			host.promptRunner = () => context.services.peek(AGENT_PROMPT_RUNNER);
			host.workflowOwner = () => context.services.peek(AUTOMATION_WORKFLOW_INVOCATIONS);
			context.lifetime.register(settings.subscribe(() => host?.updateBridgeAccess()));
			host.synthesisAgents = { directory: () => context.services.peek(AGENT_DIRECTORY), sessions: () => context.services.peek(AGENT_SESSIONS),
				runner: () => context.services.peek(AGENT_PROMPT_RUNNER), dispatch: () => context.services.peek(AGENT_DISPATCH) };
			await host.ready;
			host.setEnabled(true);
		},
		async dispose() {
			workflowLifetime.abort();
			try { await host?.dispose(); } finally { host = undefined; }
		},
	};
}
