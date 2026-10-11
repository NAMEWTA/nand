import type { BrowserWorkbenchPort } from './workbench-port';
import { Platform, type App } from 'obsidian';
import {
	BrowserError,
	newPageState,
	type BrowserAgentDeliveryPort,
	type BrowserAutomationPort,
	type BrowserOpenRequest,
	type BrowserPageState,
	type BrowserSettings,
	type BrowserGrab,
} from '../core/model';
import { normalizeBrowserUrl } from '../core/url';
import { BrowserBridge } from '../platform/desktop/bridge';
import { electronBrowserApi } from '../platform/desktop/electron-api';
import { BrowserPage } from '../platform/desktop/page';
import { BrowserStore } from '../platform/store';
import type { AgentPromptRunner, AgentRunContextProvider } from '../../agent/api';
import type { SynthesisAgents } from './synthesis';
import { t } from '../../../shared/i18n';
import type { BrowserHost } from './page-host';
import { BrowserProfileStore } from '../platform/profile-store';
import { DEFAULT_PROFILE, profilePartition, type BrowserProfile, type ProfilePage } from '../core/profiles';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
import { deviceId } from '../../../host/obsidian/storage/device-id';
import { PageControl, type ControlledPage } from './page-control';
import type { Workspace } from './workspace';
import type { BrowserPageTarget } from '../core/control';
import { DEFAULT_WORKSPACE_FOLDER } from '../core/workspace/location';
import type { WorkspaceProvider } from '../core/workspace/model';
import type { WorkspaceRecoveryDraft, WorkspaceRecoveryReview } from '../core/workspace/recovery';
import { snapshotJson } from '../core/workspace/snapshot';
import { PageOwnership, type PageLease, type PageOwner } from '../core/page-ownership';
import type { ScopedBrowserPermit } from '../core/scoped-grant';
import type { ScopedBrowserRuns } from './scoped-runs';
import type { BrowserGrants } from './grants';
import type { WebAssistant } from './assistant';
import type { UserAdapters } from './user-adapters';
import type { BrowserWorkflows } from './workflows';
import type { AutomationWorkflowInvocations } from '../../automations/api';
import type { AssistantRecoveryDraft, AssistantRecoveryReview } from '../core/assistant/recovery';

const READ_ONLY_METHODS = new Set(['snapshot', 'get', 'screenshot', 'console', 'network', 'wait', 'review']);

export class BrowserModule implements BrowserHost, BrowserAutomationPort {
	private active = false;
	private listeners = new Set<() => void>();
	private pages = new Map<string, BrowserPage>();
	private presentations = new Map<string, { activate: (admit?: () => void) => Promise<void>; close: () => void | Promise<void>; state?: () => BrowserPageState }>();
	private readonly ownership = new PageOwnership();
	presentationExists(id: string): boolean { return this.presentations.has(id); }
	private modals = new Set<{ close(): void }>();
	private bridge?: BrowserBridge;
	private bridgeReady?: Promise<BrowserBridge>;
	private scopedRuns?: ScopedBrowserRuns;
	private scopedRunsPending?: Promise<ScopedBrowserRuns>;
	private grants?: BrowserGrants;
	private grantsPending?: Promise<BrowserGrants>;
	private assistant?: WebAssistant;
	private assistantPending?: Promise<WebAssistant>;
	private userAdapters?: UserAdapters;
	private userAdaptersPending?: Promise<UserAdapters>;
	private workflows?: BrowserWorkflows;
	private workflowsPending?: Promise<BrowserWorkflows>;
	workflowOwner?: () => AutomationWorkflowInvocations | undefined;
	private assistantRecoveryReview?: { folder: string; review: AssistantRecoveryReview; record?: AssistantRecoveryDraft };
	private generation = 0;
	private readonly store: BrowserStore;
	private readonly profileStore: BrowserProfileStore;
	readonly ready: Promise<void>;
	private pendingPages = new Map<string, { state: BrowserPageState; done: Promise<void> }>();
	private profileOperations = new Set<Promise<void>>();
	private taskWorkspace?: Workspace;
	private taskWorkspacePending?: Promise<Workspace>;
	private offTaskWorkspace?: () => void;
	private recoveryReview?: { folder: string; review: WorkspaceRecoveryReview; record?: WorkspaceRecoveryDraft };
	readonly control: PageControl;
	promptRunner?: () => AgentPromptRunner | undefined;
	synthesisAgents?: SynthesisAgents;
	constructor(
		readonly app: App,
		readonly settings: () => BrowserSettings,
		readonly agents: BrowserAgentDeliveryPort,
		/** Opens browser pages as workbench pages (and focus-mode tabs); the workbench owns their placement. */
		private readonly workbench: BrowserWorkbenchPort,
		/** Opens a page in a dialog (the dialog UI loads on first use). */
		private readonly openModal: (state: BrowserPageState, closed: () => void) => Promise<{ close(): void }>,
	) {
		const changed = () => {
			for (const page of this.pages.values()) page.updatePermissions();
			for (const listener of this.listeners) listener();
		};
		this.store = new BrowserStore(app, changed);
		this.profileStore = new BrowserProfileStore(privateVaultStorage(app), `.nand/browser/${deviceId(app)}/profiles.json`, changed);
		this.ready = Promise.all([this.store.ready, this.profileStore.ready]).then(() => undefined);
		void this.ready.catch(() => undefined);
		this.control = new PageControl({
			enabled: () => this.active,
			pages: () => this.controlledPages(),
			open: request => this.open(request),
			activate: async id => {
				const target = this.liveTarget(id), lease = this.claimPage(target, { kind: 'control', id: crypto.randomUUID() });
				try { await this.activate(id, () => { this.workspacePage(target); lease.admit(); }); } finally { lease.release(); }
			},
			close: async id => {
				const target = this.liveTarget(id), page = this.workspacePage(target), presentation = this.presentations.get(id);
				const owner = this.ownership.owner(target);
				if (owner && owner.kind !== 'control') throw new BrowserError('browser_workspace_busy');
				this.ownership.revoke(target);
				const lease = this.claimPage(target, { kind: 'control', id: crypto.randomUUID() });
				try {
					await presentation?.close();
					if (!this.pages.has(id) || this.pages.get(id) === page) await this.workbench.close(id);
				} finally { lease.release(); }
			},
		});
	}
	private controlledPages(held?: { target: BrowserPageTarget; operation: ScopedBrowserPermit['operation']; admit(): void }): ControlledPage[] {
		return [...this.pages.values()].flatMap(page => {
			if (held && page.state.id !== held.target.pageId) return [];
			const automation = page.automation;
			if (page.disposed || !automation) return [];
			const target = { pageId: page.state.id, profileId: page.profileId, generation: page.generation };
			return [{
				info: () => ({ target: { pageId: page.state.id, profileId: page.profileId, generation: page.generation },
					url: page.state.url, title: page.state.title, loading: page.state.loading, error: page.state.error }),
				execute: async (method, params, admission) => {
					if (held) {
						const review = ['click', 'keypress'].includes(held.operation);
						if (review && method !== 'review' && method !== 'reviewed') throw new BrowserError('browser_action_review_changed');
						const requested = method === 'review' ? (params.action as { kind?: unknown } | undefined)?.kind : method;
						if (requested !== held.operation && !(method === 'reviewed' && review)) throw new BrowserError('browser_scoped_grant_scope');
						if (method === 'reviewed') params = { ...params, expectedOperation: held.operation };
					}
					const lease = held || READ_ONLY_METHODS.has(method) ? undefined : this.claimPage(target, { kind: 'control', id: crypto.randomUUID() });
					try { return await automation.execute(method, params, () => {
						admission(); held?.admit(); lease?.admit();
						if (page.disposed || this.pages.get(page.state.id) !== page || page.automation !== automation)
							throw new BrowserError('browser_stale_target');
					}); } finally { lease?.release(); }
				},
			}];
		});
	}
	/** A request reuses its task lease and the exact same typed controller and guest queue. */
	scopedControl(permit: ScopedBrowserPermit, lease: PageLease, signal: AbortSignal): PageControl {
		const target = { ...permit.target };
		const admit = () => {
			permit.admit(); lease.admit(); this.workspacePage(target);
			if (signal.aborted) throw new BrowserError('browser_scoped_grant_revoked');
		};
		const denied = () => Promise.reject(new BrowserError('browser_scoped_grant_scope'));
		return new PageControl({ enabled: () => this.active, pages: () => this.controlledPages({ target, operation: permit.operation, admit }),
			open: denied, close: denied, activate: async id => {
				if (permit.operation !== 'tab.switch') throw new BrowserError('browser_scoped_grant_scope');
				admit(); await this.activate(id, admit); admit();
			} });
	}
	claimAssistant(target: BrowserPageTarget, taskId: string, signal: AbortSignal): PageLease {
		return this.claimPage(target, { kind: 'assistant', id: taskId }, signal);
	}
	/** Resolving an unknown handle must not initialize the assistant or open a bridge. */
	resolveScopedRun(...args: Parameters<AgentRunContextProvider['resolve']>): ReturnType<AgentRunContextProvider['resolve']> {
		return this.scopedRuns?.resolve(...args) ?? Promise.resolve(undefined);
	}
	getScopedRuns(): Promise<ScopedBrowserRuns> {
		if (!this.active || !Platform.isDesktopApp) return Promise.reject(new BrowserError('browser_disabled'));
		if (!this.scopedRunsPending) {
			const generation = this.generation;
			this.scopedRunsPending = import('./scoped-runs').then(({ ScopedBrowserRuns }) => {
				if (!this.active || generation !== this.generation) throw new BrowserError('browser_disabled');
				return this.scopedRuns = new ScopedBrowserRuns({ id: () => crypto.randomUUID(), now: () => Date.now(),
					connect: async (port, signal, expiresAt) => {
						const bridge = await this.ensureBridge();
						if (!this.active || generation !== this.generation) throw new BrowserError('browser_disabled');
						return bridge.createScoped(port, signal, expiresAt);
					} });
			}).catch((error: unknown) => { if (generation === this.generation) this.scopedRunsPending = undefined; throw error; });
		}
		return this.scopedRunsPending;
	}
	peekAssistant(): WebAssistant | undefined { return this.assistant; }
	peekGrants(): BrowserGrants | undefined { return this.grants; }
	getGrants(): Promise<BrowserGrants> {
		if (!this.active || !Platform.isDesktopApp) return Promise.reject(new BrowserError('browser_disabled'));
		if (!this.grantsPending) {
			const generation = this.generation;
			this.grantsPending = import('./grants').then(({ BrowserGrants }) => {
				if (!this.active || generation !== this.generation) throw new BrowserError('browser_disabled');
				const win = this.app.workspace.containerEl.win;
				return this.grants = new BrowserGrants({ control: this.control, id: () => crypto.randomUUID(), now: () => Date.now(),
					connect: async (port, signal, expiresAt) => {
						const bridge = await this.ensureBridge();
						if (!this.active || generation !== this.generation) throw new BrowserError('browser_disabled');
						return bridge.createScoped(port, signal, expiresAt);
					}, claim: (target, id, signal) => this.claimPage(target, { kind: 'external', id }, signal),
					scopedControl: (permit, lease, signal) => this.scopedControl(permit, lease, signal),
					accountLabel: id => { const profile = this.requireProfile(id); return profile.kind === 'default' ? t('browser.profile.default') : profile.label; },
					changed: () => { for (const listener of this.listeners) listener(); },
					after: (ms, work) => { const timer = win.setTimeout(work, ms); return () => win.clearTimeout(timer); },
				});
			}).catch((error: unknown) => { if (generation === this.generation) this.grantsPending = undefined; throw error; });
		}
		return this.grantsPending;
	}
	openAccess(ownerWindow?: Window): Promise<void> { return this.workbench.openAccess?.(ownerWindow) ?? Promise.reject(new BrowserError('browser_disabled')); }
	peekWorkflows(): BrowserWorkflows | undefined { return this.workflows; }
	getWorkflows(): Promise<BrowserWorkflows> {
		if (!this.active) return Promise.reject(new BrowserError('browser_disabled'));
		if (!this.workflowsPending) {
			const generation = this.generation;
			this.workflowsPending = (async () => {
				const { createWorkflowRuntime } = await import('./workflow-runtime');
				if (!this.active || generation !== this.generation) throw new BrowserError('browser_disabled');
				const workflows = await createWorkflowRuntime(this.app, this.settings().workspaceFolder ?? DEFAULT_WORKSPACE_FOLDER, {
					control: this.control, owner: () => this.workflowOwner?.(), claim: (target, id, signal) => this.claimPage(target, { kind: 'workflow', id }, signal),
					scopedControl: (permit, lease, signal) => this.scopedControl(permit, lease, signal),
					accountLabel: profileId => { const profile = this.requireProfile(profileId); return profile.kind === 'default' ? t('browser.profile.default') : profile.label; },
					open: id => this.openWorkflows(id), changed: () => { for (const listener of this.listeners) listener(); },
				});
				try { await workflows.ready; if (!this.active || generation !== this.generation) throw new BrowserError('browser_disabled'); this.workflows = workflows; return workflows; }
				catch (error) { await workflows.shutdown().catch(() => undefined); throw error; }
			})().catch((error: unknown) => { if (generation === this.generation) this.workflowsPending = undefined; throw error; });
		}
		return this.workflowsPending;
	}
	openWorkflows(id?: string, ownerWindow?: Window): Promise<void> { return this.workbench.openWorkflows?.(id, ownerWindow) ?? Promise.reject(new BrowserError('browser_disabled')); }
	getAssistant(): Promise<WebAssistant> {
		if (!this.active) return Promise.reject(new BrowserError('browser_disabled'));
		if (!this.assistantPending) {
			const generation = this.generation;
			this.assistantPending = (async () => {
				const { createAssistantRuntime } = await import('./assistant-runtime');
				if (!this.active || generation !== this.generation) throw new BrowserError('browser_disabled');
				const assistant = await createAssistantRuntime(this.app, this.settings().workspaceFolder ?? DEFAULT_WORKSPACE_FOLDER, {
					agents: this.synthesisAgents ?? { directory: () => undefined, sessions: () => undefined, runner: () => undefined, dispatch: () => undefined },
					control: this.control, contexts: () => this.getScopedRuns(), claim: (target, id, signal) => this.claimAssistant(target, id, signal),
					scopedControl: (permit, lease, signal) => this.scopedControl(permit, lease, signal),
					accountLabel: profileId => { const profile = this.requireProfile(profileId); return profile.kind === 'default' ? t('browser.profile.default') : profile.label; },
					changed: () => { for (const listener of this.listeners) listener(); },
				});
				try {
					await assistant.ready;
					if (!this.active || generation !== this.generation) throw new BrowserError('browser_disabled');
					this.assistant = assistant; return assistant;
				} catch (error) { await assistant.shutdown().catch(() => undefined); throw error; }
			})().catch((error: unknown) => { if (generation === this.generation) this.assistantPending = undefined; throw error; });
		}
		return this.assistantPending;
	}
	openAssistant(taskId?: string, ownerWindow?: Window): Promise<void> { return this.workbench.openAssistant(taskId, ownerWindow); }
	async guidanceChoices(target: BrowserPageTarget): Promise<Array<{ id: string; label: string }>> {
		this.workspacePage(target); const workspace = await this.getWorkspace(); this.workspacePage(target);
		const data = workspace.data();
		return data.exchanges.flatMap(exchange => {
			const turn = data.turns.find(turn => turn.id === exchange.turnId), task = data.tasks.find(task => task.id === turn?.taskId);
			const binding = task?.targets.find(binding => binding.id === exchange.targetId);
			if (!task || !turn || exchange.imported || !binding?.page || snapshotJson(binding.page) !== snapshotJson(target) || workspace.busy(task.id)) return [];
			return [{ id: exchange.id, label: `${task.title} · ${t('browser.workspace.turn', { sequence: turn.sequence })} · ${t('browser.workspace.provider.' + binding.provider)} · ${binding.accountLabel}` }];
		});
	}
	async saveGuidance(target: BrowserPageTarget, grab: BrowserGrab, exchangeId: string, win?: Window): Promise<void> {
		const frozen = structuredClone(grab), page = this.workspacePage(target), workspace = await this.getWorkspace();
		if (this.workspacePage(target) !== page || page.state.url !== frozen.url) throw new BrowserError('browser_stale_target');
		const taskId = await workspace.addSelection(exchangeId, frozen.text, { page: { ...target }, url: frozen.url, title: frozen.title, selector: frozen.selector,
			rect: frozen.rect, viewport: frozen.viewport, ...(frozen.messageId ? { messageId: frozen.messageId } : {}), ...(frozen.conversationId ? { conversationId: frozen.conversationId } : {}) });
		await this.openWorkspace(taskId, win);
	}
	async reviewAssistantRecovery(draftId?: string): Promise<AssistantRecoveryReview> {
		const generation = this.generation, folder = this.settings().workspaceFolder ?? DEFAULT_WORKSPACE_FOLDER;
		if (!draftId) await this.getAssistant().catch(() => undefined);
		const { readAssistantRecovery } = await import('../platform/assistant-recovery');
		const loaded = await readAssistantRecovery(this.app, folder, draftId);
		if (!this.active || generation !== this.generation) throw new BrowserError('browser_disabled');
		this.assistantRecoveryReview = { folder, ...loaded }; return structuredClone(loaded.review);
	}
	async restoreAssistantRecovery(id: string): Promise<void> {
		const saved = this.assistantRecoveryReview, generation = this.generation;
		if (!saved || saved.review.id !== id || !saved.review.canRestore || !saved.record || !saved.review.local
			|| saved.folder !== (this.settings().workspaceFolder ?? DEFAULT_WORKSPACE_FOLDER)) throw new BrowserError('browser_workspace_preview_changed');
		const { readAssistantRecovery } = await import('../platform/assistant-recovery');
		const current = await readAssistantRecovery(this.app, saved.folder, saved.review.draftId);
		if (!this.active || generation !== this.generation) throw new BrowserError('browser_disabled');
		if (snapshotJson(current.record) !== snapshotJson(saved.record) || snapshotJson(current.review.local) !== snapshotJson(saved.review.local)) throw new BrowserError('browser_workspace_preview_changed');
		const assistant = await this.getAssistant(); this.assistantRecoveryReview = undefined;
		await assistant.restoreRecovery(saved.record, saved.review.local);
	}
	openWorkspace(taskId?: string, ownerWindow?: Window): Promise<void> { return this.workbench.openTask(taskId, ownerWindow); }
	async exportWorkspace(text: string, extension: 'md' | 'maiw.jsonl'): Promise<string> {
		const generation = this.generation, folder = this.settings().workspaceFolder ?? DEFAULT_WORKSPACE_FOLDER;
		const { saveWorkspaceExport } = await import('../platform/workspace-export');
		return saveWorkspaceExport(this.app, folder, text, extension, () => {
			if (!this.active || this.generation !== generation) throw new BrowserError('browser_disabled');
			if ((this.settings().workspaceFolder ?? DEFAULT_WORKSPACE_FOLDER) !== folder) throw new BrowserError('browser_workspace_preview_changed');
		});
	}
	async openWorkspaceAnswer(exchangeId: string, captureId: string, ownerWindow?: Window): Promise<void> {
		if (!Platform.isDesktopApp) throw new BrowserError('browser_workspace_desktop');
		const generation = this.generation;
		const [{ openWorkspaceSource }, { workspaceProviders }] = await Promise.all([import('./workspace-source'), import('../platform/desktop/provider-registry')]);
		if (!this.active || this.generation !== generation) throw new BrowserError('browser_disabled');
		const workspace = await this.getWorkspace();
		await openWorkspaceSource(workspace.data(), exchangeId, captureId, {
			providers: workspaceProviders({ enabled: () => this.active && this.generation === generation, page: target => this.workspacePage(target),
				activate: (target, signal) => this.activate(target.pageId, () => { this.workspacePage(target); if (signal.aborted) throw new BrowserError('browser_workspace_paused'); }) }),
			open: async (url, profileId) => {
				this.requireProfile(profileId);
				const existing = [...this.pages.values()].find(page => !page.disposed && page.state.url === url && page.profileId === profileId);
				const id = existing?.state.id ?? await this.openInWindow({ url, profileId, target: 'tab', reuse: false }, ownerWindow);
				if (!this.active || this.generation !== generation) throw new BrowserError('browser_disabled');
				return this.liveTarget(id);
			}, claim: target => this.claimPage(target, { kind: 'control', id: crypto.randomUUID() }),
		});
	}
	async reviewWorkspaceRecovery(draftId?: string): Promise<WorkspaceRecoveryReview> {
		const generation = this.generation, folder = this.settings().workspaceFolder ?? DEFAULT_WORKSPACE_FOLDER;
		// Establish normal local recovery first when possible; a broken journal must not prevent reading Markdown.
		if (!draftId) await this.getWorkspace().catch(() => undefined);
		const { readWorkspaceRecovery } = await import('../platform/workspace-recovery');
		const loaded = await readWorkspaceRecovery(this.app, folder, draftId);
		if (!this.active || this.generation !== generation) throw new BrowserError('browser_disabled');
		this.recoveryReview = { folder, ...loaded }; return structuredClone(loaded.review);
	}
	async restoreWorkspaceRecovery(id: string): Promise<void> {
		const saved = this.recoveryReview, generation = this.generation;
		if (!saved || saved.review.id !== id || !saved.review.canRestore || !saved.record || !saved.review.local
			|| saved.folder !== (this.settings().workspaceFolder ?? DEFAULT_WORKSPACE_FOLDER)) throw new BrowserError('browser_workspace_preview_changed');
		const { readWorkspaceRecovery } = await import('../platform/workspace-recovery');
		const current = await readWorkspaceRecovery(this.app, saved.folder, saved.review.draftId);
		if (!this.active || this.generation !== generation) throw new BrowserError('browser_disabled');
		if (snapshotJson(current.record) !== snapshotJson(saved.record) || snapshotJson(current.review.local) !== snapshotJson(saved.review.local))
			throw new BrowserError('browser_workspace_preview_changed');
		const workspace = await this.getWorkspace();
		this.recoveryReview = undefined;
		await workspace.restoreRecovery(saved.record, saved.review.local);
	}
	workspaceSnapshot(): ReturnType<Workspace['data']> | undefined { return this.taskWorkspace?.data(); }
	workspaceBusy(taskId: string): boolean { return this.taskWorkspace?.busy(taskId) ?? false; }
	pauseWorkspace(taskId: string): void { this.taskWorkspace?.pause(taskId); }
	async takeoverWorkspaceTarget(taskId: string, targetId: string): Promise<void> {
		const workspace = await this.getWorkspace(), binding = workspace.data().tasks.find(task => task.id === taskId)?.targets.find(target => target.id === targetId);
		if (!binding) throw new BrowserError('browser_workspace_targets');
		const target = this.liveTarget(binding.page?.pageId ?? binding.id);
		if (target.profileId !== binding.profileId) throw new BrowserError('browser_workspace_identity_changed');
		workspace.pause(taskId); this.ownership.revoke(target);
		await this.control.activate(target);
	}
	/** Ordinary browser startup never loads task documents or provider adapters. */
	getUserAdapters(): Promise<UserAdapters> {
		if (!this.active) return Promise.reject(new BrowserError('browser_disabled'));
		if (!this.userAdaptersPending) {
			const generation = this.generation;
			this.userAdaptersPending = (async () => {
				const [{ UserAdapters }, { markdownUserAdapterStore }, { workspaceRecoveryDirectory }] = await Promise.all([
					import('./user-adapters'), import('../platform/user-adapter-store'), import('../platform/workspace-recovery'),
				]);
				const folder = this.settings().workspaceFolder ?? DEFAULT_WORKSPACE_FOLDER;
				const recovery = await workspaceRecoveryDirectory(this.app, folder) + '/adapters-' + crypto.randomUUID() + '.json';
				if (!this.active || this.generation !== generation) throw new BrowserError('browser_disabled');
				const store = markdownUserAdapterStore(this.app, folder, recovery, () => { for (const listener of this.listeners) listener(); });
				const adapters = new UserAdapters({ store, workspace: () => this.getWorkspace(),
					page: target => ({ url: this.workspacePage(target).state.url, accountLabel: this.requireProfile(target.profileId).label || t('browser.profile.default') }),
					enabled: () => this.active && this.generation === generation, id: () => crypto.randomUUID(), now: () => Date.now(),
				});
				this.userAdapters = adapters;
				try { await store.ready; if (!this.active || this.generation !== generation) throw new BrowserError('browser_disabled'); return adapters; }
				catch (error) { await adapters.shutdown().catch(() => undefined); throw error; }
			})().catch((error: unknown) => { this.userAdaptersPending = undefined; throw error; });
		}
		return this.userAdaptersPending;
	}
	getWorkspace(): Promise<Workspace> {
		if (!this.active) return Promise.reject(new BrowserError('browser_disabled'));
		if (!this.taskWorkspacePending) {
			const generation = this.generation;
			const changed = () => { for (const listener of this.listeners) listener(); };
			this.taskWorkspacePending = (async () => {
				const { createWorkspaceRuntime } = await import('./workspace-runtime');
				if (!this.active || this.generation !== generation) throw new BrowserError('browser_disabled');
				const workspace = await createWorkspaceRuntime(this.app, this.settings().workspaceFolder ?? DEFAULT_WORKSPACE_FOLDER, {
					agents: this.synthesisAgents,
					adapter: async (binding, taskId) => (await this.getUserAdapters()).resolve(binding, taskId),
					enabled: () => this.active && this.generation === generation,
					page: target => this.workspacePage(target),
					target: binding => {
						const page = this.pages.get(binding.page?.pageId ?? binding.id);
						if (!page || page.disposed || page.profileId !== binding.profileId) throw new BrowserError('browser_stale_target');
						return { pageId: page.state.id, profileId: page.profileId, generation: page.generation };
					},
					claim: (target, taskId, signal) => this.claimPage(target, { kind: 'workspace', id: taskId }, signal),
					activate: (target, signal) => this.activate(target.pageId, () => {
						this.workspacePage(target); if (signal.aborted) throw new BrowserError('browser_workspace_paused');
					}), changed,
				});
				this.taskWorkspace = workspace;
				try {
					await workspace.ready;
					if (!this.active || this.generation !== generation) throw new BrowserError('browser_disabled');
					this.offTaskWorkspace = workspace.subscribe(changed); changed(); return workspace;
				} catch (error) {
					if (this.taskWorkspace === workspace) this.taskWorkspace = undefined;
					await workspace.shutdown().catch(() => undefined); throw error;
				}
			})().catch((error: unknown) => { this.taskWorkspacePending = undefined; throw error; });
		}
		return this.taskWorkspacePending;
	}
	private workspacePage(target: BrowserPageTarget): BrowserPage {
		const page = this.pages.get(target.pageId);
		if (!this.active) throw new BrowserError('browser_disabled');
		if (!page || page.disposed || page.profileId !== target.profileId || page.generation !== target.generation) throw new BrowserError('browser_stale_target');
		return page;
	}
	private liveTarget(id: string): BrowserPageTarget {
		const page = this.pages.get(id); if (!page) throw new BrowserError('browser_page_not_live');
		return { pageId: id, profileId: page.profileId, generation: page.generation };
	}
	private claimPage(target: BrowserPageTarget, owner: PageOwner, signal?: AbortSignal): PageLease {
		const page = this.workspacePage(target); if (!page.automation) throw new BrowserError('browser_page_not_live');
		return this.ownership.claim(target, owner, signal ? AbortSignal.any([signal, page.automation.queue.abort.signal]) : page.automation.queue.abort.signal,
			() => { if (owner.kind === 'workspace') this.pauseWorkspace(owner.id); });
	}
	async createWorkspaceTask(title: string, profileId: string, accountLabel: string, provider?: WorkspaceProvider): Promise<string> {
		this.requireProfile(profileId);
		const workspace = await this.getWorkspace(), profile = this.requireProfile(profileId);
		return workspace.createTask(title, profileId, accountLabel.trim() || profile.label || t('browser.profile.default'), provider);
	}
	async addWorkspaceTarget(taskId: string, provider: WorkspaceProvider, profileId: string, accountLabel: string): Promise<string> {
		this.requireProfile(profileId);
		const workspace = await this.getWorkspace(), profile = this.requireProfile(profileId);
		return workspace.addTarget(taskId, provider, profileId, accountLabel.trim() || profile.label || t('browser.profile.default'));
	}
	async removeWorkspaceTarget(taskId: string, targetId: string): Promise<void> {
		const workspace = await this.getWorkspace();
		if (workspace.busy(taskId)) throw new BrowserError('browser_workspace_busy');
		const target = workspace.data().tasks.find(task => task.id === taskId)?.targets.find(target => target.id === targetId);
		if (!target) throw new BrowserError('browser_workspace_targets');
		const presentation = this.presentations.get(target.page?.pageId ?? target.id);
		await workspace.removeTarget(taskId, targetId);
		await presentation?.close();
	}
	async rebindWorkspaceTarget(taskId: string, targetId: string, profileId: string): Promise<void> {
		this.requireProfile(profileId);
		const workspace = await this.getWorkspace(), profile = this.requireProfile(profileId);
		const target = workspace.data().tasks.find(task => task.id === taskId)?.targets.find(target => target.id === targetId);
		if (!target) throw new BrowserError('browser_workspace_targets');
		const presentation = this.presentations.get(target.page?.pageId ?? target.id);
		await workspace.rebindTarget(taskId, targetId, profile.id, profile.kind === 'default' ? t('browser.profile.default') : profile.label);
		await presentation?.close();
	}
	profiles(): BrowserProfile[] { return this.profileStore.list(); }
	private requireProfile(id: string): BrowserProfile {
		if (!this.active) throw new BrowserError('browser_disabled');
		const profile = this.profileStore.get(id);
		if (profile.state !== 'ready') throw new BrowserError('browser_profile_deleting');
		return profile;
	}
	async createProfile(label: string): Promise<BrowserProfile> {
		if (!this.active) throw new BrowserError('browser_disabled');
		return this.profileStore.create(label);
	}
	async renameProfile(id: string, label: string): Promise<void> {
		this.requireProfile(id);
		await this.profileStore.rename(id, label);
	}
	profilePages(id: string): ProfilePage[] {
		const states = [...this.workbench.list(), ...[...this.pendingPages.values()].map(row => row.state), ...[...this.pages.values()].map(page => page.state)];
		return [...new Map(states.filter(state => (state.profileId ?? DEFAULT_PROFILE) === id).map(state => [state.id, { id: state.id, title: state.title, url: state.url }])).values()];
	}
	removeProfile(id: string, confirmedPageIds: readonly string[]): Promise<void> {
		const operation = this.deleteProfile(id, confirmedPageIds);
		this.profileOperations.add(operation);
		void operation.finally(() => this.profileOperations.delete(operation)).catch(() => undefined);
		return operation;
	}
	private async deleteProfile(id: string, confirmedPageIds: readonly string[]): Promise<void> {
		if (!this.active) throw new BrowserError('browser_disabled');
		const generation = this.generation;
		const ensureActive = () => {
			if (!this.active || generation !== this.generation) throw new BrowserError('browser_disabled');
		};
		if (this.profileStore.get(id).kind === 'default') throw new BrowserError('browser_profile_default');
		const affected = this.profilePages(id).map(page => page.id).sort();
		if (JSON.stringify(affected) !== JSON.stringify([...confirmedPageIds].sort())) throw new BrowserError('browser_profile_pages_changed');
		// Persist deletion intent before touching guests or account storage. Interrupted deletion can be retried.
		await this.profileStore.markDeleting(id);
		ensureActive();
		await Promise.allSettled([...this.pendingPages.values()].filter(page => page.state.profileId === id).map(page => page.done));
		for (const page of this.profilePages(id)) {
			ensureActive();
			await this.presentations.get(page.id)?.close();
			await this.workbench.close(page.id);
		}
		ensureActive();
		const session = electronBrowserApi(this.app.workspace.containerEl.win).session.fromPartition(profilePartition(this.store.vaultId, id));
		await session.clearStorageData();
		ensureActive();
		await session.clearCache();
		ensureActive();
		await this.profileStore.remove(id);
	}
	permissions(profileId = DEFAULT_PROFILE): Record<string, boolean> {
		return profileId === DEFAULT_PROFILE ? { ...this.store.permissions } : this.profileStore.permissions(profileId);
	}
	async grantPermission(origin: string, permission: string, allowed: boolean, profileId = DEFAULT_PROFILE): Promise<void> {
		this.requireProfile(profileId);
		if (profileId === DEFAULT_PROFILE) await this.store.grant(origin, permission, allowed);
		else await this.profileStore.grant(profileId, origin, permission, allowed);
		for (const page of this.pages.values()) page.updatePermissions();
	}
	enabled(): boolean {
		return this.active;
	}
	history() {
		return this.store.history;
	}
	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}
	setEnabled(value: boolean): void {
		if (value === this.active) return;
		this.active = value;
		if (!value) {
			this.grants?.dispose(); this.grants = undefined; this.grantsPending = undefined;
			void this.workflows?.shutdown().catch(() => undefined);
			void this.assistant?.shutdown().catch(() => undefined);
			void this.userAdapters?.shutdown().catch(() => undefined);
			this.scopedRuns?.dispose(); this.scopedRuns = undefined; this.scopedRunsPending = undefined;
			this.ownership.clear();
			this.offTaskWorkspace?.(); this.offTaskWorkspace = undefined;
			void this.taskWorkspace?.shutdown().catch(() => undefined);
			this.generation++;
			this.bridge?.dispose();
			this.bridge = undefined;
			this.bridgeReady = undefined;
			for (const modal of [...this.modals]) modal.close();
			for (const page of this.pages.values()) page.dispose();
			this.pages.clear();
		}
		for (const listener of this.listeners) listener();
	}
	async ensureBridge(): Promise<BrowserBridge> {
		if (!this.active || !Platform.isDesktopApp) throw new BrowserError('browser_disabled');
		if (!this.bridgeReady) {
			const generation = this.generation;
			const bridge = new BrowserBridge(
				this.app.workspace.containerEl.win,
				electronBrowserApi(this.app.workspace.containerEl.win),
				this.store.vaultId,
				this,
				this.settings().agentAccess,
			);
			this.bridge = bridge;
			this.bridgeReady = bridge
				.start()
				.then(() => {
					if (generation !== this.generation) {
						bridge.dispose();
						throw new BrowserError('browser_disabled');
					}
					return bridge;
				})
				.catch((error: unknown) => {
					if (this.bridge === bridge) {
						this.bridgeReady = undefined;
						this.bridge = undefined;
					}
					bridge.dispose();
					throw error;
				});
		}
		return this.bridgeReady;
	}
	/** Bridge variables for a new agent terminal; empty (and no bridge started) unless agent access is on. */
	updateBridgeAccess(): void { this.bridge?.setBroadEnabled(this.settings().agentAccess); }
	async environment(): Promise<Record<string, string>> {
		return this.active && Platform.isDesktopApp && this.settings().agentAccess ? (await this.ensureBridge()).environment : {};
	}
	async connectionCommand(): Promise<string> {
		if (!this.settings().agentAccess) throw new BrowserError('browser_unauthorized');
		const bridge = await this.ensureBridge();
		const quote = (value: string) =>
			`'${Platform.isWin ? value.replace(/'/g, "''") : value.replace(/'/g, "'\\''")}'`;
		const token = quote(bridge.environment.NAND_BROWSER_TOKEN!);
		const environment = Platform.isWin ? `$env:NAND_BROWSER_TOKEN=${token}; ` : `NAND_BROWSER_TOKEN=${token} `;
		return `${environment}node ${quote(bridge.cliPath)} tab list --connection ${quote(bridge.contextPath)}`;
	}
	createPage(
		state: BrowserPageState,
		container: HTMLElement,
		changed: (state: BrowserPageState) => void,
	): BrowserPage {
		if (!this.active) throw new BrowserError('browser_disabled');
		if (this.pages.has(state.id)) throw new BrowserError('browser_duplicate_page');
		const profileId = state.profileId ?? DEFAULT_PROFILE;
		this.requireProfile(profileId);
		const partition = profilePartition(this.store.vaultId, profileId);
		const page = new BrowserPage({ ...state }, container, partition, {
			permissions: () => this.permissions(profileId),
			changed,
			visited: (url, title) => this.store.record(url, title),
			open: (url) => {
				void this.openInWindow({ url, profileId }, container.win).catch((error: unknown) => {
					page.state.error = String(error);
					page.emit();
				});
			},
		});
		this.pages.set(state.id, page);
		return page;
	}
	releasePage(id: string): void {
		this.pages.get(id)?.dispose();
		this.pages.delete(id);
	}
	registerPresentation(id: string, activate: (admit?: () => void) => Promise<void>, close: () => void | Promise<void>, state?: () => BrowserPageState): () => void {
		if (this.presentations.has(id)) throw new BrowserError('browser_duplicate_page');
		const value = { activate, close, state };
		this.presentations.set(id, value);
		return () => {
			if (this.presentations.get(id) === value) this.presentations.delete(id);
		};
	}
	open(request: BrowserOpenRequest): Promise<string> { return this.openInWindow(request); }
	async openInWindow(request: BrowserOpenRequest, ownerWindow?: Window): Promise<string> {
		const url = normalizeBrowserUrl(request.url ?? '', this.settings().searchEngine);
		if (!Platform.isDesktopApp) {
			if (url !== 'about:blank') (ownerWindow ?? this.app.workspace.containerEl.win).open(url, '_blank');
			return '';
		}
		if (!this.active) throw new BrowserError('browser_disabled');
		const profileId = request.profileId ?? DEFAULT_PROFILE;
		this.requireProfile(profileId);
		if (request.reuse) {
			const existing = [...this.pages.values()].find((page) => page.state.url === url && page.profileId === profileId);
			if (existing) {
				await this.activate(existing.state.id);
				return existing.state.id;
			}
		}
		const state = newPageState(crypto.randomUUID(), {
			url, profileId,
			zoom: request.zoom,
			title: request.title,
			scroll: request.scroll,
		});

		let finish!: () => void;
		const generation = this.generation;
		this.pendingPages.set(state.id, { state, done: new Promise<void>(resolve => { finish = resolve; }) });
		try {
			if (request.target === 'modal') {
				let modal: { close(): void } | undefined;
				modal = await this.openModal(state, () => { if (modal) this.modals.delete(modal); });
				if (generation !== this.generation) { modal.close(); throw new BrowserError('browser_disabled'); }
				this.modals.add(modal);
			} else {
				if (request.target === 'tab') await this.workbench.openTab(state, ownerWindow);
				else await this.workbench.open(state, ownerWindow);
			}
			const page = this.pages.get(state.id);
			if (!page) throw new BrowserError('browser_unavailable');
			await page.ready;
			await page.initialLoad;
			if (generation !== this.generation) throw new BrowserError('browser_disabled');
			return state.id;
		} finally { this.pendingPages.delete(state.id); finish(); }
	}

	async activate(id: string, admit?: () => void): Promise<void> {
		admit?.();
		const p = this.presentations.get(id);
		if (!p) throw new BrowserError('browser_tab_not_found');
		await p.activate(admit); admit?.();
	}
	copyText(text: string): void {
		electronBrowserApi(this.app.workspace.containerEl.win).clipboard.writeText(text);
	}
	copyImage(data: string): void {
		const api = electronBrowserApi(this.app.workspace.containerEl.win);
		api.clipboard.writeImage(api.nativeImage.createFromDataURL(data));
	}
	async saveImage(data: string, context?: string): Promise<string[]> {
		return (await this.ensureBridge()).writeArtifact(data, context);
	}
	async execute(method: string, params: Record<string, unknown>, authorized: () => void = () => {}): Promise<unknown> {
		authorized();
		if (!this.active) throw new BrowserError('browser_disabled');
		if (method === 'tab.list') {
			const live = [...this.pages.values()].map((page) => ({ ...page.state, generation: page.generation }));
			for (const state of this.workbench.list()) if (!live.some((row) => row.id === state.id)) live.push({ ...state, generation: '' });
			return { tabs: live };
		}
		if (method === 'tab.create')
			return { page: await this.open({ url: typeof params.url === 'string' ? params.url : '' }) };
		const id = typeof params.page === 'string' ? params.page : '';
		if (!id) throw new BrowserError('browser_page_required');
		if (method === 'tab.close') {
			if (!this.presentations.has(id) && !this.workbench.list().some(state => state.id === id)) throw new BrowserError('browser_tab_not_found');
			if (this.pages.has(id)) { await this.control.close(this.liveTarget(id)); return { closed: id }; }
			await this.presentations.get(id)?.close();
			await this.workbench.close(id);
			return { closed: id };
		}
		if (method === 'tab.switch') {
			if (!this.presentations.has(id)) await this.workbench.activate(id);
			await this.control.activate(this.liveTarget(id));
			return { page: id };
		}
		const page = this.controlledPages().find(page => page.info().target.pageId === id);
		if (!page) throw new BrowserError('browser_page_not_live');
		const target = page.info().target;
		const admission = () => {
			authorized();
			if (!this.active) throw new BrowserError('browser_disabled');
			if (this.pages.get(id)?.generation !== target.generation ||
				(params.generation !== undefined && params.generation !== target.generation) ||
				(params.profileId !== undefined && params.profileId !== target.profileId)) throw new BrowserError('browser_stale_target');
		};
		const result = await page.execute(method, structuredClone(params), admission);
		admission();
		return result;
	}
	async dispose(): Promise<void> {
		this.recoveryReview = undefined;
		this.assistantRecoveryReview = undefined;
		this.setEnabled(false);
		this.listeners.clear();
		this.presentations.clear();
		await Promise.allSettled([...this.profileOperations]);
		await this.taskWorkspacePending?.catch(() => undefined);
		await this.assistantPending?.catch(() => undefined);
		await this.userAdaptersPending?.catch(() => undefined);
		await this.workflowsPending?.catch(() => undefined);
		await Promise.all([this.taskWorkspace?.shutdown(), this.assistant?.shutdown(), this.userAdapters?.shutdown(), this.workflows?.shutdown(), this.store.shutdown(), this.profileStore.shutdown()]);
	}
}
