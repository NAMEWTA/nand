import type { BrowserControl } from '../api';
import type { BrowserActionReview, BrowserPageTarget } from '../core/control';
import { EXTERNAL_BROWSER_OPERATIONS, type ExternalAccessGrant, type ExternalAccessRequest } from '../core/external-access';
import { BrowserError } from '../core/model';
import type { PageLease } from '../core/page-ownership';
import { ScopedBrowserGrant, type ScopedBrowserConnection, type ScopedBrowserPermit, type ScopedBrowserPort } from '../core/scoped-grant';
import { ScopedBrowserExecutor } from './scoped-executor';

interface GrantPorts {
	control: BrowserControl;
	connect(port: ScopedBrowserPort, signal: AbortSignal, expiresAt: number): Promise<ScopedBrowserConnection>;
	claim(target: BrowserPageTarget, id: string, signal: AbortSignal): PageLease;
	scopedControl(permit: ScopedBrowserPermit, lease: PageLease, signal: AbortSignal): BrowserControl;
	accountLabel(id: string): string;
	id(): string; now(): number; changed(): void; after(ms: number, work: () => void): () => void;
}
interface LiveGrant {
	record: ExternalAccessGrant;
	grant: ScopedBrowserGrant;
	abort: AbortController;
	executor: ScopedBrowserExecutor;
	clear(): void;
	disconnect?(): void;
	requests: Map<AbortSignal, { leases: PageLease[]; releasing: boolean }>;
	decisions: Map<string, { review: BrowserActionReview; settle(allowed: boolean): void }>;
}
const sameTarget = (a: BrowserPageTarget, b: BrowserPageTarget) => a.pageId === b.pageId && a.profileId === b.profileId && a.generation === b.generation;

/** User-created, runtime-only credentials share the same typed tools, page leases and native queue. */
export class BrowserGrants {
	private closed = false;
	private readonly grants = new Map<string, LiveGrant>();
	constructor(private readonly ports: GrantPorts) {}
	list(): ExternalAccessGrant[] {
		return [...this.grants.values()].reverse().map(entry => structuredClone({ ...entry.record, used: entry.grant.inspect().used }));
	}
	async create(input: ExternalAccessRequest): Promise<{ grant: ExternalAccessGrant; environment: Readonly<Record<string, string>> }> {
		if (this.closed) throw new BrowserError('browser_disabled');
		const request = structuredClone(input);
		if (!request || typeof request.purpose !== 'string' || !request.purpose.trim() || request.purpose.length > 200
			|| !Number.isSafeInteger(request.minutes) || request.minutes < 1 || request.minutes > 30
			|| !Array.isArray(request.operations) || request.operations.some(operation => !EXTERNAL_BROWSER_OPERATIONS.includes(operation)))
			throw new BrowserError('browser_scoped_grant_invalid');
		if ([...this.grants.values()].filter(entry => entry.record.state === 'active').length >= 16) throw new BrowserError('browser_workspace_busy');
		const now = this.ports.now(), id = this.ports.id();
		const grant = new ScopedBrowserGrant({ id, taskId: id, targets: request.targets, operations: request.operations,
			expiresAt: now + request.minutes * 60_000, maxOperations: request.maxOperations }, () => this.ports.now());
		const live = this.ports.control.list();
		const pages = grant.inspect().targets.map(target => {
			const page = live.find(page => sameTarget(page.target, target));
			if (!page || page.loading || page.error) throw new BrowserError('browser_page_not_live');
			return { target, title: page.title, url: page.url, accountLabel: this.ports.accountLabel(target.profileId) };
		});
		const record: ExternalAccessGrant = { id, taskId: id, purpose: request.purpose.trim(), pages, operations: request.operations, createdAt: now,
			expiresAt: grant.inspect().expiresAt, maxOperations: request.maxOperations, used: 0, state: 'active', events: [] };
		const entry: LiveGrant = { record, grant, abort: new AbortController(), executor: undefined!, clear: () => {}, requests: new Map(), decisions: new Map() };
		entry.executor = new ScopedBrowserExecutor(grant, { id: () => this.ports.id(), now: () => this.ports.now(),
			control: (permit, signal) => {
				const context = entry.requests.get(signal); if (!context) throw new BrowserError('browser_scoped_grant_revoked');
				const lease = this.ports.claim(permit.target, id, signal); context.leases.push(lease);
				lease.signal.addEventListener('abort', () => {
					if (!context.releasing && !signal.aborted) this.revoke(id);
				}, { once: true, signal });
				return this.ports.scopedControl(permit, lease, signal);
			}, confirm: (review, signal) => this.confirm(entry, review, signal), step: async event => {
				const safe = structuredClone(event); delete safe.evidence;
				record.events = [...record.events.filter(old => old.id !== safe.id), safe].slice(-200); record.used = grant.inspect().used; this.ports.changed();
			} });
		for (const [oldId, old] of this.grants) {
			if (this.grants.size < 32) break;
			if (old.record.state !== 'active') this.grants.delete(oldId);
		}
		this.grants.set(id, entry); entry.clear = this.ports.after(record.expiresAt - now, () => this.revoke(id, 'expired')); this.ports.changed();
		try {
			const connection = await this.ports.connect({ execute: (method, params, signal) => this.execute(entry, method, params, signal) }, entry.abort.signal, record.expiresAt);
			entry.disconnect = connection.dispose;
			if (this.closed || entry.abort.signal.aborted) { connection.dispose(); throw new BrowserError('browser_scoped_grant_revoked'); }
			grant.assertActive();
			return { grant: structuredClone(record), environment: Object.freeze({ ...connection.environment, NAND_BROWSER_TASK: record.taskId }) };
		} catch (error) { this.revoke(id, 'failed'); throw error; }
	}
	private async execute(entry: LiveGrant, method: string, params: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
		entry.grant.assertActive();
		if (this.closed || signal.aborted) throw new BrowserError('browser_scoped_grant_revoked');
		if (params.taskId !== entry.record.taskId) throw new BrowserError('browser_scoped_grant_scope');
		if (method === 'tab.list') {
			return { tabs: this.ports.control.list().filter(page => entry.record.pages.some(allowed => sameTarget(allowed.target, page.target)))
				.map(page => ({ id: page.target.pageId, profileId: page.target.profileId, generation: page.target.generation, title: page.title, url: page.url, loading: page.loading, error: page.error })) };
		}
		if (method === 'fill' && typeof params.expectedValue !== 'string') throw new BrowserError('browser_invalid_argument');
		const request = new AbortController(), linked = AbortSignal.any([entry.abort.signal, signal]), stop = () => request.abort();
		linked.addEventListener('abort', stop, { once: true }); if (linked.aborted) stop();
		const context = { leases: [] as PageLease[], releasing: false }; entry.requests.set(request.signal, context);
		try { return await entry.executor.execute(method, params, request.signal); }
		finally {
			context.releasing = true; for (const lease of context.leases) lease.release(); request.abort();
			entry.requests.delete(request.signal); linked.removeEventListener('abort', stop);
			if (entry.grant.inspect().used >= entry.record.maxOperations) this.revoke(entry.record.id, 'exhausted');
		}
	}
	confirmations(id: string): BrowserActionReview[] { return [...this.grants.get(id)?.decisions.values() ?? []].map(decision => structuredClone(decision.review)); }
	decide(id: string, reviewId: string, allowed: boolean): void {
		const entry = this.grants.get(id), decision = entry?.decisions.get(reviewId);
		if (!entry || !decision) throw new BrowserError('browser_action_review_changed');
		entry.grant.assertActive(); decision.settle(allowed);
	}
	private confirm(entry: LiveGrant, review: BrowserActionReview, signal: AbortSignal): Promise<boolean> {
		entry.grant.assertActive(); if (signal.aborted) return Promise.resolve(false);
		return new Promise(resolve => {
			let settled = false, clear = () => {};
			const abort = () => settle(false);
			const settle = (allowed: boolean) => {
				if (settled) return; settled = true; clear(); signal.removeEventListener('abort', abort); entry.decisions.delete(review.id);
				this.ports.changed(); resolve(allowed && !signal.aborted && !entry.abort.signal.aborted && this.ports.now() < review.expiresAt);
			};
			entry.decisions.set(review.id, { review: structuredClone(review), settle }); signal.addEventListener('abort', abort, { once: true });
			clear = this.ports.after(Math.max(0, Math.min(60_000, review.expiresAt - this.ports.now())), () => settle(false)); this.ports.changed();
		});
	}
	revoke(id: string, state: Exclude<ExternalAccessGrant['state'], 'active'> = 'revoked'): void {
		const entry = this.grants.get(id); if (!entry || entry.record.state !== 'active') return;
		entry.record.state = state; entry.clear(); entry.grant.revoke(); entry.abort.abort(); entry.disconnect?.(); entry.disconnect = undefined;
		for (const decision of [...entry.decisions.values()]) decision.settle(false);
		this.ports.changed();
	}
	async takeover(id: string, target: BrowserPageTarget): Promise<void> {
		const entry = this.grants.get(id);
		if (!entry || !entry.record.pages.some(page => sameTarget(page.target, target))) throw new BrowserError('browser_scoped_grant_scope');
		for (const candidate of this.grants.values()) if (candidate.record.pages.some(page => sameTarget(page.target, target))) this.revoke(candidate.record.id);
		await this.ports.control.activate(target);
	}
	dispose(): void { this.closed = true; for (const id of this.grants.keys()) this.revoke(id); }
}
