import type { BrowserControl } from '../api';
import type { BrowserActionReceipt, BrowserActionReview, BrowserReviewableAction, BrowserElementRef, BrowserElementValue, BrowserObservation, BrowserPageAction, BrowserPageInfo, BrowserPageTarget } from '../core/control';
import { BrowserError, type BrowserOpenRequest } from '../core/model';

export interface ControlledPage {
	info(): BrowserPageInfo;
	/** The existing guest queue invokes admission immediately before dispatch. */
	execute(method: string, params: Record<string, unknown>, admission: () => void): Promise<unknown>;
}
export interface PageControlPorts {
	enabled(): boolean;
	pages(): ControlledPage[];
	open(request: BrowserOpenRequest): Promise<string>;
	activate(pageId: string): Promise<void>;
	close(pageId: string): Promise<void>;
}

/** Binds every queued call and returned observation to a single immutable guest identity. */
export class PageControl implements BrowserControl {
	constructor(private readonly ports: PageControlPorts) {}
	list(): BrowserPageInfo[] { return this.ports.enabled() ? this.ports.pages().map(page => structuredClone(page.info())) : []; }
	private resolve(target: BrowserPageTarget): ControlledPage {
		if (!this.ports.enabled()) throw new BrowserError('browser_disabled');
		const page = this.ports.pages().find(page => page.info().target.pageId === target.pageId);
		const current = page?.info().target;
		if (!page || !current || current.profileId !== target.profileId || current.generation !== target.generation)
			throw new BrowserError('browser_stale_target');
		return page;
	}
	async open(request: BrowserOpenRequest): Promise<BrowserPageTarget> {
		const id = await this.ports.open({ ...request });
		const page = this.list().find(page => page.target.pageId === id);
		if (!page) throw new BrowserError('browser_stale_target');
		return page.target;
	}
	private async execute(target: BrowserPageTarget, method: string, params: Record<string, unknown>): Promise<unknown> {
		const bound = { ...target }, page = this.resolve(bound);
		const admission = () => { this.resolve(bound); };
		const result = await page.execute(method, structuredClone(params), admission);
		admission(); // A late result from a closed/replaced guest is never published under a new identity.
		return result;
	}
	async observe(target: BrowserPageTarget): Promise<BrowserObservation> {
		const bound = { ...target };
		const result = await this.execute(bound, 'snapshot', {}) as Omit<BrowserObservation, 'target'>;
		return { target: bound, url: result.url, revision: result.revision, snapshot: result.snapshot, refs: result.refs };
	}
	async readElement(target: BrowserPageTarget, ref: BrowserElementRef): Promise<BrowserElementValue> {
		return await this.execute(target, 'get', { ...ref }) as BrowserElementValue;
	}
	async screenshot(target: BrowserPageTarget, full = false): Promise<string> {
		const result = await this.execute(target, 'screenshot', { full }) as { dataUrl: string };
		return result.dataUrl;
	}
	async reviewAction(target: BrowserPageTarget, action: BrowserReviewableAction): Promise<BrowserActionReview> {
		return await this.execute(target, 'review', { action }) as BrowserActionReview;
	}
	async actReviewed(target: BrowserPageTarget, reviewId: string): Promise<BrowserActionReceipt> {
		const bound = { ...target };
		const result = await this.execute(bound, 'reviewed', { id: reviewId }) as Pick<BrowserActionReceipt, 'operation'>;
		return { target: bound, operation: result.operation };
	}
	async act(target: BrowserPageTarget, action: BrowserPageAction): Promise<BrowserActionReceipt> {
		const bound = { ...target }, request = structuredClone(action);
		if (!['navigate', 'reload', 'back', 'forward', 'stop', 'click', 'focus', 'fill', 'type', 'select', 'check', 'keypress'].includes(request.kind))
			throw new BrowserError('browser_unknown_method');
		let method: string = request.kind, params: Record<string, unknown> = {};
		if (request.kind === 'navigate') { method = 'goto'; params = { url: request.url }; }
		else if (request.kind === 'reload') params = { hard: request.bypassCache === true };
		else {
			if ('ref' in request && request.ref) params = { ...request.ref };
			if ('value' in request) params.value = request.value;
			if ('expectedValue' in request) params.expectedValue = request.expectedValue;
			if ('checked' in request) params.checked = request.checked;
			if ('key' in request) params.key = request.key;
		}
		await this.execute(bound, method, params);
		return { target: bound, operation: request.kind };
	}
	async activate(target: BrowserPageTarget): Promise<void> {
		const bound = { ...target };
		this.resolve(bound);
		await this.ports.activate(bound.pageId);
		this.resolve(bound);
	}
	async close(target: BrowserPageTarget): Promise<void> {
		const bound = { ...target };
		this.resolve(bound);
		await this.ports.close(bound.pageId);
	}
}
