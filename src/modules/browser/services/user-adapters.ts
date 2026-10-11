import { BrowserError } from '../core/model';
import type { BrowserPageTarget } from '../core/control';
import { adapterMatches, adapterMaterial, adapterVersion, validateAdapterDefinition, type AdapterDefinition, type ProviderOverride, type UserAdapter } from '../core/providers/user-adapter';
import { snapshotJson } from '../core/workspace/snapshot';
import type { AnswerCapture, TargetBinding, WorkspaceTurn } from '../core/workspace/model';
import type { UserAdapterStore } from '../platform/user-adapter-store';
import type { Workspace } from './workspace';

export interface AdapterReview { id: string; rule: UserAdapter; target: BrowserPageTarget; scenario: string; turn: WorkspaceTurn }
export interface AdapterResult { review: AdapterReview; exchangeId: string; capture: AnswerCapture }
interface CandidateRun { review: AdapterReview; phase: 'preview' | 'send' | 'confirm'; commits: number; live: boolean }
interface AdapterPorts {
	store: UserAdapterStore; workspace(): Promise<Workspace>; page(target: BrowserPageTarget): { url: string; accountLabel: string };
	enabled(): boolean; id(): string; now(): number;
}

/** Candidate authority exists only during an explicit verification operation. Documents never contain executable code or grants. */
export class UserAdapters {
	private readonly reviews = new Map<string, AdapterReview>();
	private readonly results = new Map<string, AdapterResult>();
	private readonly candidates = new Map<string, CandidateRun>();
	private readonly reserved = new Set<string>();
	private readonly revoked = new Set<string>();
	private readonly busy = new Set<string>();
	private closed = false;
	private closing?: Promise<void>;
	constructor(private readonly ports: AdapterPorts) {}
	async list(): Promise<UserAdapter[]> { this.admit(); await this.ports.store.refresh(); this.admit(); return this.ports.store.data().rules; }
	state() { return this.ports.store.state(); }
	retrySave(): Promise<void> { this.admit(); return this.ports.store.retrySave(); }
	private admit(): void { if (this.closed || !this.ports.enabled()) throw new BrowserError('browser_disabled'); }
	private rule(id: string): UserAdapter {
		this.admit(); const rule = this.ports.store.data().rules.find(row => row.id === id);
		if (!rule) throw new BrowserError('browser_adapter_invalid'); return rule;
	}
	private same(rule: UserAdapter): void {
		if (this.revoked.has(rule.id) || snapshotJson(this.rule(rule.id)) !== snapshotJson(rule)) throw new BrowserError('browser_workspace_preview_changed');
	}
	private invalidate(id: string): void {
		this.revoked.add(id);
		for (const run of this.candidates.values()) if (run.review.rule.id === id) run.live = false;
		for (const [key, review] of this.reviews) if (review.rule.id === id) this.reviews.delete(key);
		for (const [key, result] of this.results) if (result.review.rule.id === id) this.results.delete(key);
	}
	async save(definition: AdapterDefinition, id?: string): Promise<UserAdapter> {
		const input = structuredClone(definition); validateAdapterDefinition(input); await this.list();
		const previous = id ? this.rule(id) : undefined;
		if (previous) this.invalidate(previous.id);
		const now = this.ports.now(), rule: UserAdapter = { title: input.title.trim(), provider: input.provider, origin: input.origin,
			profileScope: input.profileScope, pathPattern: input.pathPattern, selectors: { ...input.selectors },
			id: previous?.id ?? this.ports.id(), version: (previous?.version ?? 0) + 1, createdAt: previous?.createdAt ?? now, updatedAt: now, state: 'candidate' };
		await this.ports.store.put(rule, previous); this.revoked.delete(rule.id); return rule;
	}
	async disable(id: string): Promise<void> {
		this.invalidate(id); await this.ports.store.refresh(); const rule = this.rule(id);
		await this.ports.store.put({ ...rule, state: 'disabled', updatedAt: this.ports.now() }, rule);
	}
	async resolve(binding: TargetBinding, taskId: string): Promise<ProviderOverride | undefined> {
		this.admit(); await this.ports.store.refresh(); this.admit();
		if (!binding.page) throw new BrowserError('browser_stale_target');
		const url = this.ports.page(binding.page).url, candidate = this.candidates.get(taskId);
		if (this.reserved.has(taskId) && !candidate) throw new BrowserError('browser_adapter_review');
		const matching = this.ports.store.data().rules.filter(rule => rule.state === 'enabled' && !this.revoked.has(rule.id) && adapterMatches(rule, binding, url));
		if (!candidate && matching.length > 1) throw new BrowserError('browser_adapter_conflict');
		const rule = candidate?.review.rule ?? matching[0]; if (!rule) return undefined;
		const admit = () => {
			this.same(rule);
			if (!adapterMatches(rule, binding, this.ports.page(binding.page!).url)) throw new BrowserError('browser_adapter_scope');
			if (candidate && (!candidate.live || snapshotJson(candidate.review.target) !== snapshotJson(binding.page))) throw new BrowserError('browser_adapter_review');
		};
		admit();
		return { rule, admit, commit: () => {
			admit(); if (candidate && (candidate.phase !== 'send' || candidate.commits++ !== 0)) throw new BrowserError('browser_adapter_review');
		} };
	}
	private async run<T>(review: AdapterReview, phase: CandidateRun['phase'], work: (workspace: Workspace) => Promise<T>): Promise<T> {
		this.same(review.rule);
		if (this.busy.has(review.rule.id)) throw new BrowserError('browser_workspace_busy');
		this.busy.add(review.rule.id);
		const run: CandidateRun = { review, phase, commits: 0, live: true }; this.candidates.set(review.turn.taskId, run);
		try { const result = await work(await this.ports.workspace()); this.same(review.rule); if (!run.live) throw new BrowserError('browser_adapter_review'); return result; }
		finally { run.live = false; this.candidates.delete(review.turn.taskId); this.busy.delete(review.rule.id); }
	}
	async preview(id: string, target: BrowserPageTarget, prompt: string, scenario: string): Promise<AdapterReview> {
		await this.list(); const rule = this.rule(id), page = this.ports.page(target);
		if (rule.state === 'enabled' || !prompt.trim() || !scenario.trim() || scenario.length > 2000 || !adapterMatches(rule, { provider: rule.provider, profileId: target.profileId }, page.url))
			throw new BrowserError('browser_adapter_scope');
		this.revoked.delete(id);
		const workspace = await this.ports.workspace(), taskId = await workspace.createTask(rule.title, rule.profileScope, page.accountLabel, rule.provider, target);
		this.reserved.add(taskId);
		const review: AdapterReview = { id: this.ports.id(), rule, target: structuredClone(target), scenario, turn: { id: '', taskId, sequence: 1, question: prompt, finalPrompt: prompt, templates: [], targets: [], createdAt: this.ports.now() } };
		await this.run(review, 'preview', async workspace => {
			const binding = workspace.data().tasks.find(row => row.id === taskId)!.targets[0]!;
			await workspace.prepareTarget(taskId, binding.id, false); await workspace.stageDraft(taskId, prompt);
			review.turn = await workspace.preview(taskId);
		});
		this.reviews.set(review.id, structuredClone(review)); return structuredClone(review);
	}
	async send(reviewId: string): Promise<AdapterResult> {
		const review = this.reviews.get(reviewId); this.reviews.delete(reviewId);
		if (!review) throw new BrowserError('browser_adapter_review');
		const result = await this.run(review, 'send', async workspace => {
			await workspace.send(review.turn.id);
			const exchange = workspace.data().exchanges.find(row => row.turnId === review.turn.id);
			const capture = exchange?.captures.find(row => row.id === exchange.currentCaptureId);
			if (!exchange || exchange.submitState !== 'submitted' || exchange.saveState !== 'saved' || !exchange.receipt || !capture?.markdown.trim()
				|| capture.parentId !== exchange.receipt.messageId || capture.adapterVersion !== adapterVersion(review.rule) + '-dom-v1'
				|| capture.reasons.includes('interrupted') || capture.reasons.includes('acquisition-timeout')) throw new BrowserError('browser_adapter_answer');
			return { review, exchangeId: exchange.id, capture };
		});
		this.results.set(reviewId, structuredClone(result)); return structuredClone(result);
	}
	async enable(reviewId: string): Promise<void> {
		const result = this.results.get(reviewId); this.results.delete(reviewId);
		if (!result) throw new BrowserError('browser_adapter_review');
		const { review, capture, exchangeId } = result;
		await this.run(review, 'confirm', workspace => workspace.confirmCurrentCapture(exchangeId, capture.id));
		await this.ports.store.refresh(); this.same(review.rule);
		const now = this.ports.now();
		await this.ports.store.put({ ...review.rule, state: 'enabled', updatedAt: now, verification: { version: review.rule.version, verifiedAt: now,
			material: adapterMaterial(review.rule), scenario: review.scenario, taskId: review.turn.taskId, turnId: review.turn.id, exchangeId, captureId: capture.id } }, review.rule);
	}
	shutdown(): Promise<void> {
		if (!this.closing) { this.closed = true; for (const run of this.candidates.values()) run.live = false;
			this.reviews.clear(); this.results.clear(); this.closing = this.ports.store.shutdown(); }
		return this.closing;
	}
}
