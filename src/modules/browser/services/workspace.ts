import type { BrowserPageTarget } from '../core/control';
import { BrowserError } from '../core/model';
import type { ProviderFactory } from '../core/providers/contracts';
import { officialConversationUrl } from '../core/providers/official-url';
import { snapshotJson } from '../core/workspace/snapshot';
import { taskDocuments, type TaskDocuments } from '../core/workspace/history';
import { mergeHistoryImport, planHistoryImport, type HistoryImportPlan } from '../core/workspace/history-transfer';
import { parseMaiwHistory, type MaiwHistory } from '../core/workspace/maiw-format';
import { changePanelLayout, removePanelLayoutTarget, type PanelChange } from '../core/workspace/panel-layout';
import { mergeWorkspaceRecovery, recoveryDocuments, type WorkspaceRecoveryDraft } from '../core/workspace/recovery';
import { verifyReadiness } from '../core/providers/verification';
import type { ProviderSession } from '../core/providers/contracts';
import type { SelectionSource, TargetCheck } from '../core/workspace/model';
import { validateSelection } from '../core/workspace/guidance';
import { freezeTurn, retryContext, type PromptSnapshot, type TargetBinding, type WorkspaceData, type WorkspaceTask, type WorkspaceTurn, type WorkspaceProvider, type WorkspaceRetryPreview } from '../core/workspace/model';
import type { WorkspaceJournal } from '../platform/workspace-journal';
import type { WorkspaceStore } from '../platform/workspace-store';
import { WorkspaceSender } from './workspace-sender';
import { WorkspaceSynthesis, type SynthesisAgents } from './synthesis';

interface WorkspacePorts {
	store: WorkspaceStore;
	journal: WorkspaceJournal;
	providers: ProviderFactory;
	/** Returns only the live target for this binding, never a current-page fallback. */
	target(binding: TargetBinding): BrowserPageTarget;
	id(): string;
	now(): number;
	hash(text: string): Promise<string>;
	agents?: SynthesisAgents;
}
interface Preview { turn: WorkspaceTurn; source: string | undefined; templateIds: string[] }
interface ReadinessReport { source: string | undefined; targets: TargetCheck[] }
export interface HistoryImportReview { id: string; history: MaiwHistory; counts: HistoryImportPlan['counts']; conflicts: HistoryImportPlan['conflicts'] }
const snapshotSource = (task: WorkspaceTask, templates: readonly PromptSnapshot[]): string | undefined => snapshotJson({ draft: task.draft,
	selected: task.selectedTargetIds, promptTemplateIds: task.promptTemplateIds, targets: task.targets.filter(target => task.selectedTargetIds.includes(target.id)), templates });

/** Durable task content and explicit actions. UI components only subscribe and submit commands. */
export class Workspace {
	private readonly listeners = new Set<() => void>();
	private readonly previews = new Map<string, Preview>();
	private readonly retryPreviews = new Map<string, { review: WorkspaceRetryPreview; source: string | undefined }>();
	private readonly checks = new Map<string, TargetCheck[]>();
	private readonly drafts = new Map<string, string>();
	private readonly draftWrites = new Map<string, Promise<void>>();
	private readonly preparing = new Map<string, { abort: AbortController; done: Promise<void> }>();
	private readonly pendingSends = new Map<string, AbortController>();
	private readonly sender: WorkspaceSender;
	private edits: Promise<unknown> = Promise.resolve();
	private closed = false;
	private closing?: Promise<void>;
	private historyImport?: { review: HistoryImportReview; plan: HistoryImportPlan; source: string | undefined };
	readonly ready: Promise<void>;
	readonly synthesis: WorkspaceSynthesis;
	constructor(private readonly ports: WorkspacePorts) {
		this.sender = new WorkspaceSender({ ...ports, changed: () => this.changed() });
		this.synthesis = new WorkspaceSynthesis({ ...ports, changed: () => this.changed() });
		this.ready = this.sender.recover().then(() => this.synthesis.recover()); void this.ready.catch(() => undefined);
	}
	private changed(): void { for (const listener of this.listeners) listener(); }
	private discardPreview(taskId: string): void {
		for (const [id, preview] of this.previews) if (preview.turn.taskId === taskId) this.previews.delete(id);
		for (const [id, preview] of this.retryPreviews) if (preview.review.taskId === taskId) this.retryPreviews.delete(id);
		this.checks.delete(taskId);
	}
	targetCheck(taskId: string, targetId: string): TargetCheck | undefined {
		const result = this.checks.get(taskId)?.find(row => row.targetId === targetId); return result && { ...result };
	}
	async checkTargets(taskId: string): Promise<TargetCheck[]> { return (await this.inspectTargets(taskId)).targets; }
	private async inspectTargets(taskId: string, targetId?: string): Promise<ReadinessReport> {
		const run = await this.edit(async () => {
			this.assertEditable(taskId);
			const abort = new AbortController(), done = this.inspectSelected(taskId, abort.signal, targetId)
				.finally(() => { this.preparing.delete(taskId); this.changed(); });
			this.preparing.set(taskId, { abort, done: done.then(() => undefined, () => undefined) }); this.changed(); return { done };
		}); return run.done;
	}
	/** Read every selected explicit binding without changing focus or writing to the website. */
	private async inspectSelected(taskId: string, signal: AbortSignal, targetId?: string): Promise<ReadinessReport> {
		await this.ports.store.refresh(); this.assertOpen();
		if (signal.aborted) throw new BrowserError('browser_workspace_paused');
		const task = this.task(taskId), ids = targetId ? [targetId] : task.selectedTargetIds, selected = new Set(ids), bindings = task.targets.filter(target => selected.has(target.id));
		if (!selected.size || selected.size !== ids.length || bindings.length !== selected.size) throw new BrowserError('browser_workspace_targets');
		const source = snapshotSource(task, []), targets: TargetCheck[] = bindings.map(target => ({ targetId: target.id, state: 'checking' }));
		this.checks.set(taskId, targets); this.changed();
		try {
			for (const [index, binding] of bindings.entries()) {
				if (signal.aborted) throw new BrowserError('browser_workspace_paused');
				let session: ProviderSession | undefined;
				try {
					if (!binding.page) { targets[index] = { targetId: binding.id, state: 'unverified', reason: 'browser_workspace_target_not_ready' }; continue; }
					session = await this.ports.providers.connect(structuredClone(binding), taskId, signal);
					const ready = await session.inspect(signal);
					if (signal.aborted) throw new BrowserError('browser_workspace_paused');
					if (ready.state !== 'ready') targets[index] = { targetId: binding.id,
						state: ready.state === 'unsupported' ? 'needs-attention' : ready.state,
						reason: ready.reason ?? 'browser_workspace_target_not_ready' };
					else {
						verifyReadiness(binding, ready);
						targets[index] = ready.draft !== '' ? { targetId: binding.id, state: 'draft-present', reason: 'browser_workspace_draft_changed' }
							: { targetId: binding.id, state: 'ready' };
					}
				} catch (error) {
					const reason = error instanceof BrowserError ? error.code : 'browser_workspace_operation_failed';
					targets[index] = { targetId: binding.id, state: ['browser_stale_target', 'browser_page_closed', 'browser_page_not_live'].includes(reason) ? 'disconnected' : 'needs-attention', reason };
				} finally { session?.dispose(); this.changed(); }
			}
			if (signal.aborted) throw new BrowserError('browser_workspace_paused');
			await this.ports.store.refresh();
			if (snapshotSource(this.task(taskId), []) !== source) throw new BrowserError('browser_workspace_preview_changed');
			return { source, targets: structuredClone(targets) };
		} finally {
			for (const target of targets) if (target.state === 'checking') { target.state = 'needs-attention'; target.reason = 'browser_workspace_paused'; }
			this.changed();
		}
	}
	subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
	data(): WorkspaceData {
		const data = this.sender.data();
		for (const task of data.tasks) if (this.drafts.has(task.id)) task.draft = this.drafts.get(task.id)!;
		return data;
	}
	/** Keep edits in the service while coalescing input that arrives during a disk write. */
	stageDraft(taskId: string, value: string): Promise<void> {
		if (this.closing) throw new BrowserError('browser_disabled');
		this.assertEditable(taskId); this.task(taskId);
		this.drafts.set(taskId, value); this.changed(); return this.flushDraft(taskId);
	}
	draftPending(taskId: string): boolean { return this.drafts.has(taskId); }
	flushDraft(taskId: string): Promise<void> {
		const current = this.draftWrites.get(taskId); if (current) return current;
		const done = (async () => {
			while (this.drafts.has(taskId)) {
				const value = this.drafts.get(taskId)!;
				await this.updateTask(taskId, { draft: value });
				if (this.drafts.get(taskId) === value) this.drafts.delete(taskId);
			}
		})().finally(() => { this.draftWrites.delete(taskId); this.changed(); });
		this.draftWrites.set(taskId, done); return done;
	}
	busy(taskId: string): boolean { return this.sender.busy(taskId) || this.preparing.has(taskId) || this.pendingSends.has(taskId); }
	private assertOpen(): void { if (this.closed) throw new BrowserError('browser_disabled'); }
	private assertEditable(taskId: string): void { this.assertOpen(); if (this.busy(taskId)) throw new BrowserError('browser_workspace_busy'); }
	private task(taskId: string): WorkspaceTask {
		const task = this.data().tasks.find(task => task.id === taskId);
		if (!task) throw new BrowserError('browser_workspace_task_missing'); return task;
	}
	private edit<T>(work: () => Promise<T>): Promise<T> {
		const next = this.edits.then(async () => { this.assertOpen(); await this.ready; this.assertOpen(); return work(); });
		this.edits = next.catch(() => undefined); return next;
	}
	createTask(title: string, profileId: string, accountLabel: string, provider: WorkspaceProvider = 'deepseek', page?: BrowserPageTarget): Promise<string> {
		const frozenPage = page && structuredClone(page);
		return this.edit(async () => {
			if (!officialConversationUrl(provider)) throw new BrowserError('browser_workspace_provider_unsupported');
			if (frozenPage && frozenPage.profileId !== profileId) throw new BrowserError('browser_workspace_identity_changed');
			const id = this.ports.id(), targetId = this.ports.id(), now = this.ports.now();
			if (!title.trim()) throw new BrowserError('browser_workspace_task_title');
			await this.ports.store.edit(data => data.tasks.push({ id, title: title.trim(), pinned: false, createdAt: now, updatedAt: now, draft: '',
				targets: [{ id: targetId, provider, profileId, accountLabel, status: 'unverified', ...(frozenPage ? { page: frozenPage } : {}) }], selectedTargetIds: [targetId], visibleTargetIds: [targetId] }));
			this.changed(); return id;
		});
	}
	/** Read-only final review of one saved answer; never submits, opens a page or guesses by text. */
	async confirmCurrentCapture(exchangeId: string, captureId: string): Promise<void> {
		await this.ready; await this.ports.store.refresh(); this.assertOpen();
		const data = this.data(), exchange = data.exchanges.find(row => row.id === exchangeId), turn = data.turns.find(row => row.id === exchange?.turnId);
		const binding = data.tasks.find(row => row.id === turn?.taskId)?.targets.find(row => row.id === exchange?.targetId);
		const capture = exchange?.captures.find(row => row.id === captureId);
		if (!turn || !binding || !capture || exchange?.currentCaptureId !== captureId) throw new BrowserError('browser_adapter_answer');
		this.assertEditable(turn.taskId);
		const session = await this.ports.providers.connect(binding, turn.taskId, new AbortController().signal);
		try {
			const ready = await session.inspect(new AbortController().signal);
			verifyReadiness(binding, ready);
			if (ready.state !== 'ready' || ready.currentMessageId !== capture.messageId || ready.identity.conversationId !== capture.conversationId)
				throw new BrowserError('browser_adapter_answer');
			if (!exchange.receipt) throw new BrowserError('browser_adapter_answer');
			const observed = await session.capture({ ...exchange.receipt, text: turn.finalPrompt }, new AbortController().signal);
			if (observed.messageId !== capture.messageId || observed.markdown !== capture.markdown || observed.adapterVersion !== capture.adapterVersion)
				throw new BrowserError('browser_adapter_answer');
		} finally { session.dispose(); }
	}
	addSelection(exchangeId: string, text: string, source: SelectionSource): Promise<string> {
		const frozen = structuredClone(source);
		return this.edit(async () => {
			let taskId = '';
			await this.ports.store.edit(data => {
				const exchange = data.exchanges.find(row => row.id === exchangeId), turn = data.turns.find(row => row.id === exchange?.turnId);
				const task = data.tasks.find(row => row.id === turn?.taskId), binding = task?.targets.find(row => row.id === exchange?.targetId);
				const original = turn?.targets.find(row => row.id === exchange?.targetId);
				if (!exchange || exchange.imported || !task || !binding || !original || binding.provider !== original.provider || binding.profileId !== original.profileId
					|| snapshotJson(this.ports.target(binding)) !== snapshotJson(frozen.page)) throw new BrowserError('browser_workspace_selection_invalid');
				this.assertEditable(task.id); validateSelection(frozen, binding.provider, binding.profileId);
				if (!text.trim() || text.length > 2000) throw new BrowserError('browser_workspace_selection_invalid');
				exchange.selections = [...(exchange.selections ?? []), { id: this.ports.id(), exchangeId, revision: 1, source: 'user-selection', complete: false,
					markdown: text, capturedAt: this.ports.now(), reasons: ['user-selection'], selection: frozen }];
				taskId = task.id;
			});
			this.changed(); return taskId;
		});
	}
	updateTask(taskId: string, change: Partial<Pick<WorkspaceTask, 'title' | 'pinned' | 'draft' | 'selectedTargetIds' | 'visibleTargetIds' | 'promptTemplateIds'>>): Promise<void> {
		const frozen = structuredClone(change);
		return this.edit(async () => {
			if (Object.keys(frozen).some(key => key !== 'visibleTargetIds')) this.assertEditable(taskId);
			await this.ports.store.edit(data => {
				const task = data.tasks.find(row => row.id === taskId);
				if (!task) throw new BrowserError('browser_workspace_task_missing');
				if (frozen.title !== undefined) { if (!frozen.title.trim()) throw new BrowserError('browser_workspace_task_title'); task.title = frozen.title.trim(); }
				if (frozen.draft !== undefined) task.draft = frozen.draft;
				if (frozen.pinned !== undefined) task.pinned = frozen.pinned;
				if (frozen.promptTemplateIds !== undefined) task.promptTemplateIds = frozen.promptTemplateIds;
				if (frozen.selectedTargetIds !== undefined) task.selectedTargetIds = frozen.selectedTargetIds;
				if (frozen.visibleTargetIds !== undefined) task.visibleTargetIds = frozen.visibleTargetIds;
				task.updatedAt = this.ports.now();
			});
			if (frozen.draft !== undefined || frozen.selectedTargetIds !== undefined || frozen.promptTemplateIds !== undefined) this.discardPreview(taskId);
			this.changed();
		});
	}
	/** Parse before any write, then retain one bounded, exact import preview. */
	async previewImport(text: string, accountLabel: string): Promise<HistoryImportReview> {
		this.historyImport = undefined;
		const history = parseMaiwHistory(text);
		await Promise.all([...this.drafts.keys()].map(id => this.flushDraft(id)));
		return this.edit(async () => {
			this.assertImportable(); await this.ports.store.refresh();
			const data = this.data(), source = snapshotJson(recoveryDocuments(data));
			const plan = await planHistoryImport(history, data, { ...this.ports, accountLabel });
			this.assertOpen(); this.assertImportable();
			const review = { id: this.ports.id(), history, counts: plan.counts, conflicts: plan.conflicts };
			this.historyImport = { review, plan, source }; return structuredClone(review);
		});
	}
	private assertImportable(): void {
		if (this.data().tasks.some(task => this.busy(task.id))) throw new BrowserError('browser_workspace_busy');
		if (this.drafts.size || this.ports.store.hasPendingSave()) throw new BrowserError('browser_workspace_save_pending');
	}
	/** Apply exactly one reviewed import without connecting to a website or adding journal evidence. */
	commitImport(id: string): Promise<void> {
		return this.edit(async () => {
			this.assertImportable();
			const cached = this.historyImport;
			if (!cached || cached.review.id !== id) throw new BrowserError('browser_workspace_preview_changed');
			this.historyImport = undefined;
			await this.ports.store.edit(data => {
				if (snapshotJson(recoveryDocuments(data)) !== cached.source) throw new BrowserError('browser_workspace_preview_changed');
				Object.assign(data, mergeHistoryImport(data, cached.plan));
			}); this.changed();
		});
	}
	/** Flush the current draft before showing the exact local deletion scope. */
	async reviewDeleteTask(taskId: string): Promise<TaskDocuments> {
		await this.flushDraft(taskId);
		return this.edit(async () => { this.assertEditable(taskId); await this.ports.store.refresh(); return taskDocuments(this.data(), taskId); });
	}
	/** Marks this exact reviewed set of local documents deleted; website history and template library stay outside the scope. */
	deleteTask(expected: TaskDocuments): Promise<void> {
		const frozen = structuredClone(expected), taskId = frozen.task.id;
		return this.edit(async () => {
			this.assertEditable(taskId);
			if (this.drafts.has(taskId)) throw new BrowserError('browser_workspace_preview_changed');
			await this.ports.store.edit(data => {
				if (snapshotJson(taskDocuments(data, taskId)) !== snapshotJson(frozen)) throw new BrowserError('browser_workspace_preview_changed');
				const turns = new Set(frozen.turns.map(turn => turn.id));
				data.tasks = data.tasks.filter(task => task.id !== taskId);
				data.turns = data.turns.filter(turn => turn.taskId !== taskId);
				data.exchanges = data.exchanges.filter(exchange => !turns.has(exchange.turnId));
			}); this.discardPreview(taskId); this.changed();
		});
	}
	/** Stable template identities and revisions preserve history and reject stale editor writes. */
	saveTemplate(title: string, body: string, existing?: { id: string; revision: number }): Promise<string> {
		const expected = existing && { ...existing };
		return this.edit(async () => {
			if (!title.trim() || !body.trim()) throw new BrowserError('browser_workspace_template_empty');
			const id = expected?.id ?? this.ports.id(), now = this.ports.now();
			await this.ports.store.edit(data => {
				if (expected) {
					const template = data.templates.find(row => row.id === id);
					if (!template || template.revision !== expected.revision) throw new BrowserError('browser_workspace_template_missing');
					Object.assign(template, { title: title.trim(), body, revision: template.revision + 1, updatedAt: now });
				} else data.templates.push({ id, title: title.trim(), body, revision: 1, order: data.templates.reduce((max, row) => Math.max(max, row.order), -1) + 1, createdAt: now, updatedAt: now });
			}); this.changed(); return id;
		});
	}
	deleteTemplate(id: string, revision: number): Promise<void> {
		return this.edit(async () => {
			await this.ports.store.edit(data => {
				const template = data.templates.find(row => row.id === id);
				if (!template || template.revision !== revision) throw new BrowserError('browser_workspace_template_missing');
				data.templates = data.templates.filter(row => row.id !== id);
				for (const task of data.tasks) if (task.promptTemplateIds?.includes(id)) task.promptTemplateIds = task.promptTemplateIds.filter(selected => selected !== id);
			}); this.changed();
		});
	}
	moveTemplate(id: string, direction: -1 | 1): Promise<void> {
		return this.edit(async () => {
			await this.ports.store.edit(data => {
				const ordered = data.templates.toSorted((a, b) => a.order - b.order), index = ordered.findIndex(row => row.id === id);
				const template = ordered[index], neighbor = ordered[index + direction];
				if (!template || !neighbor) throw new BrowserError('browser_workspace_template_missing');
				[template.order, neighbor.order] = [neighbor.order, template.order];
				for (const row of [template, neighbor]) { row.revision++; row.updatedAt = this.ports.now(); }
			}); this.changed();
		});
	}
	/** Geometry edits remain available while answers arrive and do not invalidate a reviewed send. */
	updatePanelLayout(taskId: string, change: PanelChange): Promise<void> {
		const frozen = structuredClone(change);
		return this.edit(async () => {
			await this.ports.store.edit(data => {
				const task = data.tasks.find(row => row.id === taskId); if (!task) throw new BrowserError('browser_workspace_task_missing');
				changePanelLayout(task, frozen); task.updatedAt = this.ports.now();
			}); this.changed();
		});
	}
	/** Per-target visibility edits merge in the service even while independent results are arriving. */
	setTargetVisible(taskId: string, targetId: string, visible: boolean): Promise<void> {
		return this.edit(async () => {
			await this.ports.store.edit(data => {
				const task = data.tasks.find(row => row.id === taskId); if (!task) throw new BrowserError('browser_workspace_task_missing');
				if (!task.targets.some(target => target.id === targetId)) throw new BrowserError('browser_workspace_targets');
				task.visibleTargetIds = visible ? [...new Set([...task.visibleTargetIds, targetId])] : task.visibleTargetIds.filter(id => id !== targetId);
				task.updatedAt = this.ports.now();
			}); this.changed();
		});
	}
	/** Adding a binding does not select a recipient, expose a page or alter prior immutable rounds. */
	addTarget(taskId: string, provider: WorkspaceProvider, profileId: string, accountLabel: string): Promise<string> {
		return this.edit(async () => {
			this.assertEditable(taskId);
			if (!officialConversationUrl(provider)) throw new BrowserError('browser_workspace_provider_unsupported');
			const id = this.ports.id();
			await this.ports.store.edit(data => {
				const task = data.tasks.find(row => row.id === taskId); if (!task) throw new BrowserError('browser_workspace_task_missing');
				task.targets.push({ id, provider, profileId, accountLabel, status: 'unverified' }); task.updatedAt = this.ports.now();
				task.panelLayout?.order.push(id);
			}); this.discardPreview(taskId); this.changed(); return id;
		});
	}
	/** Rebinding requires fresh website verification and leaves historical target snapshots intact. */
	rebindTarget(taskId: string, targetId: string, profileId: string, accountLabel: string): Promise<void> {
		return this.edit(async () => {
			this.assertEditable(taskId);
			await this.ports.store.edit(data => {
				const task = data.tasks.find(row => row.id === taskId), target = task?.targets.find(row => row.id === targetId);
				if (!task || !target) throw new BrowserError('browser_workspace_targets');
				task.targets = task.targets.map(row => row.id === targetId ? { id: row.id, provider: row.provider, profileId, accountLabel, status: 'unverified' } : row);
				task.selectedTargetIds = task.selectedTargetIds.filter(id => id !== targetId);
				task.visibleTargetIds = task.visibleTargetIds.filter(id => id !== targetId);
				task.updatedAt = this.ports.now();
			}); this.discardPreview(taskId); this.changed();
		});
	}
	/** Removes only a current binding. Historical turns and answers retain their original target snapshots. */
	removeTarget(taskId: string, targetId: string): Promise<void> {
		return this.edit(async () => {
			this.assertEditable(taskId);
			await this.ports.store.edit(data => {
				const task = data.tasks.find(row => row.id === taskId); if (!task) throw new BrowserError('browser_workspace_task_missing');
				if (!task.targets.some(target => target.id === targetId)) throw new BrowserError('browser_workspace_targets');
				task.targets = task.targets.filter(target => target.id !== targetId);
				removePanelLayoutTarget(task, targetId);
				task.selectedTargetIds = task.selectedTargetIds.filter(id => id !== targetId);
				task.visibleTargetIds = task.visibleTargetIds.filter(id => id !== targetId);
				task.updatedAt = this.ports.now();
			}); this.discardPreview(taskId); this.changed();
		});
	}
	/** A user action verifies the currently displayed guest and, if requested, creates a real empty website conversation. */
	async prepareTarget(taskId: string, targetId: string, newConversation: boolean): Promise<void> {
		const run = await this.edit(async () => {
			this.assertEditable(taskId);
			this.discardPreview(taskId);
			const abort = new AbortController();
			const done = this.prepare(taskId, targetId, newConversation, abort.signal).finally(() => { this.preparing.delete(taskId); this.changed(); });
			this.preparing.set(taskId, { abort, done }); this.changed(); return { done };
		});
		await run.done;
	}
	private async prepare(taskId: string, targetId: string, newConversation: boolean, signal: AbortSignal): Promise<void> {
		await this.ready; await this.ports.store.refresh(); this.assertOpen();
		if (signal.aborted) throw new BrowserError('browser_workspace_paused');
		if (this.ports.store.hasPendingSave()) throw new BrowserError('browser_workspace_save_pending');
		const original = this.task(taskId).targets.find(target => target.id === targetId);
		if (!original) throw new BrowserError('browser_workspace_targets');
		const binding = structuredClone(original); binding.page = this.ports.target(binding);
		if (binding.profileId !== binding.page.profileId) throw new BrowserError('browser_workspace_identity_changed');
		// This explicit review can adopt another official host; ordinary send connections retain the prior verified origin.
		if (binding.provider === 'coze' || binding.provider === 'minimax') binding.officialUrl = undefined;
		const session = await this.ports.providers.connect(binding, taskId, signal);
		try {
			const result = newConversation ? await session.newConversation(signal) : await session.inspect(signal);
			if (signal.aborted) throw new BrowserError('browser_workspace_paused');
			this.assertOpen();
			if (snapshotJson(result.identity.page) !== snapshotJson(binding.page) || result.identity.provider !== binding.provider)
				throw new BrowserError('browser_workspace_identity_changed');
			if (newConversation && (result.state !== 'ready' || result.messageIds.length || result.draft !== ''))
				throw new BrowserError('browser_workspace_new_conversation');
			binding.status = result.state === 'ready' ? 'ready' : result.state === 'login-required' ? 'login-required' : 'needs-attention';
			binding.conversationId = result.identity.conversationId;
			binding.adapterVersion = result.identity.adapterVersion;
			binding.officialUrl = result.state === 'ready' ? binding.provider === 'coze' || binding.provider === 'minimax' ? new URL(result.identity.url).origin + '/'
				: officialConversationUrl(binding.provider, result.identity.conversationId) : undefined;
			binding.verifiedAt = this.ports.now();
			await this.ports.store.edit(data => {
				const target = data.tasks.find(task => task.id === taskId)?.targets.find(target => target.id === targetId);
				if (!target || snapshotJson(target) !== snapshotJson(original)) throw new BrowserError('browser_workspace_storage_changed');
				Object.assign(target, binding);
			}); this.changed();
		} finally { session.dispose(); }
	}
	async preview(taskId: string, templateIds?: readonly string[], finalPrompt?: string, onlyReady = false): Promise<WorkspaceTurn> {
		await this.flushDraft(taskId);
		const report = await this.inspectTargets(taskId), readyIds = report.targets.filter(target => target.state === 'ready').map(target => target.targetId);
		if (!readyIds.length || (!onlyReady && readyIds.length !== report.targets.length)) throw new BrowserError('browser_workspace_target_not_ready');
		const selected = new Set(this.task(taskId).promptTemplateIds ?? []);
		const chosen = templateIds ? [...templateIds] : this.data().templates.toSorted((a, b) => a.order - b.order).filter(row => selected.has(row.id)).map(row => row.id);
		return this.edit(async () => {
			this.assertEditable(taskId); await this.ports.store.refresh();
			const task = this.task(taskId), data = this.data();
			if (snapshotSource(task, []) !== report.source) throw new BrowserError('browser_workspace_preview_changed');
			const templates = chosen.map(id => data.templates.find(template => template.id === id));
			if (new Set(chosen).size !== chosen.length || templates.some(template => !template)) throw new BrowserError('browser_workspace_template_missing');
			const snapshots = templates.map(template => ({ id: template!.id, revision: template!.revision, title: template!.title, body: template!.body }));
			const prompt = finalPrompt ?? [...snapshots.map(template => template.body), task.draft].join('\n\n');
			const sequence = Math.max(0, ...data.turns.filter(turn => turn.taskId === taskId).map(turn => turn.sequence)) + 1;
			const checkedTask: WorkspaceTask = { ...task, selectedTargetIds: readyIds,
				targets: task.targets.map(target => readyIds.includes(target.id) ? { ...target, status: 'ready' } : target) };
			const turn = freezeTurn(checkedTask, this.ports.id(), sequence, prompt, snapshots, this.ports.now());
			// One review per task; repeated editing cannot retain an unbounded collection of full prompts.
			this.discardPreview(taskId);
			this.checks.set(taskId, report.targets);
			this.previews.set(turn.id, { turn, source: snapshotSource(task, snapshots), templateIds: chosen }); return structuredClone(turn);
		});
	}
	/** The ID names the exact displayed prompt and target snapshot, not an instruction to rebuild it. */
	async send(previewId: string): Promise<void> {
		const reviewed = this.previews.get(previewId);
		if (!reviewed) throw new BrowserError('browser_workspace_preview_changed');
		this.assertEditable(reviewed.turn.taskId);
		const abort = new AbortController();
		this.pendingSends.set(reviewed.turn.taskId, abort); this.changed();
		const run = await this.edit(async () => {
			if (abort.signal.aborted) throw new BrowserError('browser_workspace_paused');
			const preview = this.previews.get(previewId);
			if (!preview) throw new BrowserError('browser_workspace_preview_changed');
			await this.ports.store.refresh();
			if (abort.signal.aborted) throw new BrowserError('browser_workspace_paused');
			const task = this.task(preview.turn.taskId), data = this.data();
			const templates = preview.templateIds.map(id => data.templates.find(template => template.id === id))
				.map(template => template && ({ id: template.id, revision: template.revision, title: template.title, body: template.body }));
			if (templates.some(template => !template) || snapshotSource(task, templates as PromptSnapshot[]) !== preview.source)
				throw new BrowserError('browser_workspace_preview_changed');
			this.previews.delete(previewId);
			await this.ports.store.edit(data => {
				data.turns.push(structuredClone(preview.turn));
				data.exchanges.push(...preview.turn.targets.map(target => ({ id: this.ports.id(), turnId: previewId, targetId: target.id,
					attempts: [], submitState: 'idle' as const, acquisitionState: 'idle' as const, saveState: 'saved' as const, captures: [] })));
			});
			if (abort.signal.aborted) {
				await this.ports.store.edit(data => {
					for (const exchange of data.exchanges.filter(row => row.turnId === previewId)) {
						exchange.submitState = 'paused'; exchange.lastError = 'browser_workspace_paused';
					}
				});
				throw new BrowserError('browser_workspace_paused');
			}
			// Return a container so the metadata edit queue is released during the long send/acquisition.
			return { done: this.sender.send(previewId) };
		}).finally(() => { this.pendingSends.delete(reviewed.turn.taskId); this.changed(); });
		await run.done;
	}
	pause(taskId: string): void { this.pendingSends.get(taskId)?.abort(); this.preparing.get(taskId)?.abort.abort(); this.sender.pause(taskId); }
	async previewRetry(exchangeId: string): Promise<WorkspaceRetryPreview> {
		await this.ready; await this.ports.journal.refresh();
		const initial = retryContext(this.data(), exchangeId), source = snapshotJson(initial), taskId = initial.turn.taskId;
		const report = await this.inspectTargets(taskId, initial.binding.id);
		if (report.targets.length !== 1 || report.targets[0]!.state !== 'ready') throw new BrowserError('browser_workspace_target_not_ready');
		return this.edit(async () => {
			this.assertEditable(taskId); await this.ports.store.refresh();
			const current = retryContext(this.data(), exchangeId);
			if (snapshotJson(current) !== source || snapshotSource(this.task(taskId), []) !== report.source) throw new BrowserError('browser_workspace_preview_changed');
			const review: WorkspaceRetryPreview = { id: this.ports.id(), taskId, exchangeId, finalPrompt: current.turn.finalPrompt,
				target: structuredClone(current.binding), duplicateRisk: current.exchange.submitState === 'unknown' || current.exchange.attempts.some(row => row.outcome === 'unknown') };
			this.discardPreview(taskId); this.checks.set(taskId, report.targets);
			this.retryPreviews.set(review.id, { review, source }); return structuredClone(review);
		});
	}
	/** One explicit review permits one attempt on one exchange, with the original immutable prompt. */
	async retrySend(previewId: string): Promise<void> {
		const reviewed = this.retryPreviews.get(previewId);
		if (!reviewed) throw new BrowserError('browser_workspace_preview_changed');
		const taskId = reviewed.review.taskId; this.assertEditable(taskId);
		const abort = new AbortController(); this.pendingSends.set(taskId, abort); this.changed();
		const run = await this.edit(async () => {
			if (abort.signal.aborted) throw new BrowserError('browser_workspace_paused');
			const preview = this.retryPreviews.get(previewId);
			if (!preview) throw new BrowserError('browser_workspace_preview_changed');
			await this.ports.store.refresh();
			if (abort.signal.aborted) throw new BrowserError('browser_workspace_paused');
			if (snapshotJson(retryContext(this.data(), preview.review.exchangeId)) !== preview.source) throw new BrowserError('browser_workspace_preview_changed');
			this.retryPreviews.delete(previewId);
			return { done: this.sender.retrySend(preview.review.exchangeId, preview.source) };
		}).finally(() => { this.pendingSends.delete(taskId); this.changed(); });
		await run.done;
	}
	async recollect(exchangeId: string): Promise<void> {
		const run = await this.edit(async () => {
			const exchange = this.data().exchanges.find(row => row.id === exchangeId), turn = this.data().turns.find(row => row.id === exchange?.turnId);
			if (!turn) throw new BrowserError('browser_workspace_answer_missing');
			this.assertEditable(turn.taskId); return { done: this.sender.recollect(exchangeId) };
		}); await run.done;
	}
	/** Explicitly selects one existing conversation for the next question; never sends or changes the draft. */
	followUp(exchangeId: string): Promise<void> {
		return this.edit(async () => {
			await this.ports.store.refresh();
			const data = this.data(), exchange = data.exchanges.find(row => row.id === exchangeId), turn = data.turns.find(row => row.id === exchange?.turnId);
			const task = data.tasks.find(row => row.id === turn?.taskId), original = turn?.targets.find(row => row.id === exchange?.targetId);
			const binding = task?.targets.find(row => row.id === exchange?.targetId);
			if (!exchange?.receipt || !task || !original) throw new BrowserError('browser_workspace_submission_identity');
			this.assertEditable(task.id);
			if (!binding?.page || binding.provider !== original.provider || binding.profileId !== original.profileId || binding.conversationId !== exchange.receipt.conversationId)
				throw new BrowserError('browser_workspace_identity_changed');
			await this.ports.store.edit(draft => {
				const current = draft.tasks.find(row => row.id === task.id);
				if (!current || snapshotJson(current.targets.find(row => row.id === binding.id)) !== snapshotJson(binding)) throw new BrowserError('browser_workspace_storage_changed');
				current.selectedTargetIds = [binding.id]; current.updatedAt = this.ports.now();
			}); this.discardPreview(task.id); this.changed();
		});
	}
	async retrySave(): Promise<void> {
		this.assertOpen(); await this.sender.retrySave();
		await this.synthesis.retrySave();
		await Promise.all([...this.drafts.keys()].map(id => this.flushDraft(id))); this.changed();
	}
	/** Explicit disk-only restoration. Journal evidence is re-applied; no provider session is created. */
	restoreRecovery(record: WorkspaceRecoveryDraft, expected: WorkspaceData): Promise<void> {
		if (record.path !== this.ports.store.key) return Promise.reject(new BrowserError('browser_workspace_recovery_invalid'));
		const frozen = structuredClone(record), source = snapshotJson(recoveryDocuments(expected));
		return this.edit(async () => {
			if (this.synthesis.active() || this.data().tasks.some(task => this.busy(task.id))) throw new BrowserError('browser_workspace_busy');
			if (this.drafts.size || this.ports.store.hasPendingSave()) throw new BrowserError('browser_workspace_save_pending');
			await this.ports.journal.refresh();
			this.previews.clear(); this.retryPreviews.clear(); this.checks.clear();
			await this.ports.store.edit(data => {
				if (snapshotJson(recoveryDocuments(data)) !== source) throw new BrowserError('browser_workspace_preview_changed');
				Object.assign(data, mergeWorkspaceRecovery(frozen, data));
			});
			await this.sender.recover(); await this.synthesis.recover(); this.changed();
		});
	}
	shutdown(): Promise<void> {
		if (this.closing) return this.closing;
		this.historyImport = undefined;
		this.previews.clear();
		this.retryPreviews.clear();
		this.checks.clear();
		for (const pending of this.pendingSends.values()) pending.abort();
		for (const preparing of this.preparing.values()) preparing.abort.abort();
		this.closing = (async () => {
			await Promise.all([this.synthesis.shutdown(), this.sender.shutdown()]);
			await Promise.allSettled([...this.draftWrites.values()]);
			this.closed = true; await this.edits;
			await Promise.allSettled([...this.preparing.values()].map(row => row.done));
			this.listeners.clear(); await Promise.all([this.ports.store.shutdown(), this.ports.journal.shutdown()]);
		})(); return this.closing;
	}
}
