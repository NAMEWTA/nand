import type { BrowserControl } from '../api';
import type { BrowserActionReview, BrowserElementRef, BrowserPageAction, BrowserPageTarget } from '../core/control';
import { BrowserError } from '../core/model';
import { ScopedBrowserGrant, type ScopedBrowserPermit, type ScopedBrowserPort } from '../core/scoped-grant';
import type { AssistantStep } from '../core/assistant/model';

export type ScopedBrowserStep = AssistantStep;
interface ExecutorPorts {
	id(): string;
	now(): number;
	control(permit: ScopedBrowserPermit, signal: AbortSignal): BrowserControl;
	confirm(review: BrowserActionReview, signal: AbortSignal): Promise<boolean>;
	step(step: ScopedBrowserStep): Promise<void>;
	exhausted?(): void;
}
const value = (params: Record<string, unknown>, key: string): string => {
	if (typeof params[key] !== 'string') throw new BrowserError('browser_invalid_argument', key);
	return params[key];
};

/** Maps the existing CLI wire format to typed tools. Unknown methods never fall through to the broad bridge. */
export class ScopedBrowserExecutor implements ScopedBrowserPort {
	private readonly observed = new Map<string, { revision: string; epoch: number }>();
	constructor(private readonly grant: ScopedBrowserGrant, private readonly ports: ExecutorPorts) {}
	private ref(target: BrowserPageTarget, params: Record<string, unknown>): BrowserElementRef {
		const revision = value(params, 'revision'), element = value(params, 'element'), observed = this.observed.get(target.pageId);
		if (!observed || observed.revision !== revision || observed.epoch !== this.grant.inspect().epoch || !/^@e\d+$/.test(element))
			throw new BrowserError('browser_stale_ref');
		return { revision, element };
	}
	async execute(method: string, raw: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
		if (signal.aborted) throw new BrowserError('browser_scoped_grant_revoked');
		const params = structuredClone(raw), definition = this.grant.inspect(), pageId = value(params, 'page');
		const target = definition.targets.find(target => target.pageId === pageId);
		if (!target || ('profileId' in params && params.profileId !== target.profileId) || ('generation' in params && params.generation !== target.generation))
			throw new BrowserError('browser_scoped_grant_scope');
		const permit = this.grant.reserve(method, target), control = this.ports.control(permit, signal);
		const step: ScopedBrowserStep = { id: this.ports.id(), target, operation: permit.operation, startedAt: this.ports.now(), state: 'running' };
		const admit = () => { permit.admit(); if (signal.aborted) throw new BrowserError('browser_scoped_grant_revoked'); };
		let dispatched = false;
		try {
			await this.ports.step(structuredClone(step)); admit();
			let result: unknown;
			if (method === 'snapshot') {
				const observation = await control.observe(target); admit();
				this.observed.set(target.pageId, { revision: observation.revision, epoch: definition.epoch });
				result = { ...observation, page: target.pageId };
				step.evidence = JSON.stringify({ url: observation.url, revision: observation.revision, snapshot: observation.snapshot }).slice(0, 40_000);
			} else if (method === 'get') {
				result = await control.readElement(target, this.ref(target, params));
				step.evidence = JSON.stringify(result).slice(0, 20_000);
			} else if (method === 'screenshot') {
				result = { dataUrl: await control.screenshot(target, params.full === true) };
			} else if (method === 'tab.switch') {
				await control.activate(target); result = { target };
			} else {
				let action: BrowserPageAction;
				switch (method) {
					case 'goto': action = { kind: 'navigate', url: value(params, 'url') }; break;
					case 'reload': action = { kind: 'reload', bypassCache: params.hard === true }; break;
					case 'back': case 'forward': case 'stop': action = { kind: method }; break;
					case 'click': case 'focus': action = { kind: method, ref: this.ref(target, params) }; break;
					case 'fill': action = { kind: method, ref: this.ref(target, params), value: value(params, 'value'),
						...('expectedValue' in params ? { expectedValue: value(params, 'expectedValue') } : {}) }; break;
					case 'type': case 'select': action = { kind: method, ref: this.ref(target, params), value: value(params, 'value') }; break;
					case 'check':
						if (typeof params.checked !== 'boolean') throw new BrowserError('browser_invalid_argument');
						action = { kind: method, ref: this.ref(target, params), checked: params.checked }; break;
					case 'keypress': action = { kind: method, ref: this.ref(target, params), key: value(params, 'key') }; break;
					default: throw new BrowserError('browser_scoped_grant_scope');
				}
				if (action.kind === 'click' || action.kind === 'keypress') {
					const review = await control.reviewAction(target, action.kind === 'keypress' ? action : { kind: 'click', ref: action.ref }); admit();
					step.state = 'confirming'; await this.ports.step(structuredClone(step)); admit();
					if (!await this.ports.confirm(structuredClone(review), signal)) {
						step.state = 'denied'; throw new BrowserError('browser_action_denied');
					}
					admit(); dispatched = true; result = await control.actReviewed(target, review.id);
				} else { admit(); dispatched = action.kind !== 'focus'; result = await control.act(target, action); }
				// Every mutation requires a new observation, including an action that retained the same native revision.
				this.observed.delete(target.pageId);
				step.evidence = JSON.stringify(result);
			}
			admit(); step.state = 'returned'; step.finishedAt = this.ports.now();
			await this.ports.step(structuredClone(step));
			if (this.grant.inspect().used >= definition.maxOperations) this.ports.exhausted?.();
			return result;
		} catch (error) {
			if (dispatched) this.observed.delete(target.pageId);
			if (step.state !== 'denied') step.state = dispatched ? 'unknown' : 'failed';
			step.finishedAt = this.ports.now(); step.errorCode = error instanceof BrowserError ? error.code : 'browser_failed';
			await this.ports.step(structuredClone(step)).catch(() => undefined); throw error;
		}
	}
}
