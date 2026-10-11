import { BrowserError, type BrowserGrab } from '../../core/model';
import { BrowserOperationQueue } from '../../core/operation-queue';
import { acquireDebugger } from './debugger-lease';
import { listenNative, type GuestContents } from './electron-api';
import type { BrowserPage } from './page';
import { buildSnapshot, type RefEntry, type SnapshotResult } from './snapshot-engine';
import { GRAB_ELEMENT_FUNCTION } from './grab-script';
import { consoleDiagnostic, networkDiagnostic } from '../../core/diagnostics';
import { READ_ELEMENT_VALUE } from './read-element';
import { READ_ACTION_REVIEW } from './action-review';
import type { BrowserActionReview, BrowserReviewableAction } from '../../core/control';

function record(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
function describe(value: unknown): string {
	return typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
}
function text(params: Record<string, unknown>, key: string): string {
	return typeof params[key] === 'string' ? params[key] : '';
}
function numeric(params: Record<string, unknown>, key: string, fallback: number, max = 10000): number {
	const n = Number(params[key] ?? fallback);
	if (!Number.isFinite(n) || n < 0 || n > max) throw new BrowserError('browser_invalid_argument', key);
	return n;
}
export class BrowserAutomation {
	private release?: () => void;
	private cleanups: Array<() => void> = [];
	private frames = new Map<string, string>();
	private requests = new Set<string>();
	private lastNetworkActivity = 0;
	private snapshot?: SnapshotResult;
	private revision = 0;
	private readonly epoch = crypto.randomUUID();
	private currentRevision(): string {
		return `${this.epoch}:${this.revision}`;
	}
	private checkRevision(params: Record<string, unknown>): void {
		if (!this.snapshot || params.revision !== this.currentRevision()) throw new BrowserError('browser_stale_ref');
	}
	private lost = false;
	private ready?: Promise<void>;
	private designHandler?: (grab: BrowserGrab) => void;
	private providerInputCheck?: (method: string, params: Record<string, unknown>) => Promise<void>;
	private operationAdmission?: () => void;
	private actionReview?: { review: BrowserActionReview; material: string };
	readonly queue = new BrowserOperationQueue();
	readonly consoleMessages: unknown[] = [];
	readonly networkFailures: unknown[] = [];
	constructor(
		private readonly guest: GuestContents,
		private readonly page: BrowserPage,
	) {}
	invalidate(): void {
		this.revision++;
		this.snapshot = undefined;
		this.actionReview = undefined;
	}
	private async ensure(): Promise<void> {
		if (this.lost) throw new BrowserError('browser_debugger_unavailable');
		if (!this.ready) this.ready = this.attach();
		await this.ready;
	}
	private async attach(): Promise<void> {
		this.release = acquireDebugger(this.guest);
		this.cleanups.push(
			listenNative(this.guest.debugger, 'detach', () => {
				this.lost = true;
				this.invalidate();
			}),
		);
		this.cleanups.push(
			listenNative(this.guest.debugger, 'message', (_event, method, raw, sessionId) => {
				const params = record(raw);
				if (method === 'Network.requestWillBeSent') {
					this.requests.add(String(params.requestId));
					this.lastNetworkActivity = Date.now();
				}
				if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
					this.requests.delete(String(params.requestId));
					this.lastNetworkActivity = Date.now();
				}
				if (method === 'Target.attachedToTarget') {
					const info = record(params.targetInfo);
					if (info.type === 'iframe' && typeof params.sessionId === 'string')
						this.frames.set(String(info.targetId), params.sessionId);
				}
				if (method === 'Target.detachedFromTarget') {
					for (const [id, sid] of this.frames) if (sid === params.sessionId) this.frames.delete(id);
					this.invalidate();
				}
				if (method === 'Page.frameNavigated' || method === 'Page.navigatedWithinDocument') this.invalidate();
				if (method === 'Runtime.consoleAPICalled') {
					this.consoleMessages.push(consoleDiagnostic(params));
					if (this.consoleMessages.length > 100) this.consoleMessages.shift();
				}
				if (method === 'Network.loadingFailed') {
					this.networkFailures.push(networkDiagnostic(params));
					if (this.networkFailures.length > 100) this.networkFailures.shift();
				}
				if (method === 'Overlay.inspectNodeRequested' && this.designHandler) {
					const handler = this.designHandler;
					this.designHandler = undefined;
					void this.captureGrab(
						Number(params.backendNodeId),
						typeof sessionId === 'string' && sessionId ? sessionId : undefined,
					)
						.then(handler)
						.catch((error: unknown) => {
							this.page.state.error = String(error);
							this.page.emit();
						});
				}
			}),
		);
		await this.send('Page.enable');
		await this.send('Runtime.enable');
		await this.send('DOM.enable');
		await this.send('Network.enable');
		await this.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
	}
	async send(method: string, params: Record<string, unknown> = {}, session?: string): Promise<unknown> {
		if (this.page.disposed || this.queue.abort.signal.aborted) throw new BrowserError('browser_page_closed');
		if (this.lost) throw new BrowserError('browser_debugger_unavailable');
		const releaseInput = (method === 'Input.dispatchMouseEvent' && params.type === 'mouseReleased') || (method === 'Input.dispatchKeyEvent' && params.type === 'keyUp');
		if (!releaseInput) this.operationAdmission?.();
		if (method === 'Input.insertText' || (method === 'Input.dispatchMouseEvent' && params.type === 'mousePressed') ||
			(method === 'Input.dispatchKeyEvent' && params.type === 'keyDown')) {
			await this.providerInputCheck?.(method, params);
			if (!this.page.webview.getBoundingClientRect().width || this.page.webview.ownerDocument.activeElement !== this.page.webview)
				throw new BrowserError('browser_input_focus_changed');
		}
		if (!releaseInput) this.operationAdmission?.();
		const win = this.page.webview.win;
		return new Promise((resolve, reject) => {
			const timer = win.setTimeout(() => finish(new BrowserError('browser_timeout')), 15000);
			const aborted = () => finish(new BrowserError('browser_page_closed'));
			let settled = false;
			const finish = (error?: unknown, value?: unknown) => {
				if (settled) return;
				settled = true;
				win.clearTimeout(timer);
				this.queue.abort.signal.removeEventListener('abort', aborted);
				if (error) reject(error instanceof Error ? error : new Error(describe(error)));
				else resolve(value);
			};
			this.queue.abort.signal.addEventListener('abort', aborted, { once: true });
			try {
				void this.guest.debugger.sendCommand(method, params, session).then(
					(value) => finish(undefined, value),
					(error: unknown) => finish(error),
				);
			} catch (error) {
				finish(error);
			}
		});
	}
	private async evaluate(expression: string, session?: string): Promise<unknown> {
		const result = record(
			await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session),
		);
		if (result.exceptionDetails) throw new BrowserError('browser_script_failed');
		return record(result.result).value;
	}
	/** Internal adapters supply static read-only DOM programs; this is not a bridge method. */
	readProviderDom(expression: string, admission: () => void): Promise<unknown> {
		return this.queue.run(async () => {
			admission(); await this.ensure(); admission();
			const value = await this.evaluate(expression); admission(); return value;
		});
	}
	/** Static scoped copy program shares ownership/admission with all other provider operations. */
	providerCopy(expression: string, admission: () => void): Promise<unknown> {
		return this.queue.run(async () => {
			admission(); await this.ensure(); admission();
			const value = await this.evaluate(expression); admission(); return value;
		});
	}
	/** Explicit source navigation, guarded and scrolled in one guest evaluation without editor input. */
	providerReveal(request: { selector: string; guard: string }, admission: () => void): Promise<void> {
		const frozen = { ...request };
		return this.queue.run(async () => {
			admission(); await this.ensure(); admission();
			const revealed = await this.evaluate('(()=>{if(!(' + frozen.guard + '))return false;const rows=[...document.querySelectorAll(' + JSON.stringify(frozen.selector)
				+ ')];if(rows.length!==1)return false;rows[0].scrollIntoView({block:"center",inline:"nearest",behavior:"instant"});return true})()');
			admission(); if (revealed !== true) throw new BrowserError('browser_workspace_source_not_loaded');
		});
	}
	/** Only request IDs observed by a task's endpoint allowlist reach this internal reader. */
	readProviderResponse(requestId: string, admission: () => void): Promise<unknown> {
		return this.queue.run(async () => {
			admission(); await this.ensure(); admission();
			const value = await this.send('Network.getResponseBody', { requestId }); admission(); return value;
		});
	}
	/** Finite internal provider input, sharing the same queue and native implementation as ordinary controls. */
	providerInput(request: { selector: string; kind: 'fill' | 'click'; value?: string; guard: string }, admission: () => void): Promise<void> {
		const frozen = { ...request };
		return this.queue.run(async signal => {
			admission(); await this.ensure(); admission();
			if (!this.page.webview.getBoundingClientRect().width) throw new BrowserError('browser_input_not_visible');
			this.page.webview.focus();
			const guard = async () => {
				admission();
				if (await this.evaluate(frozen.guard) !== true) throw new BrowserError('browser_workspace_draft_changed');
				admission();
			};
			try {
				await guard();
				const found = record(await this.send('Runtime.evaluate', { expression: `(()=>{const found=[...document.querySelectorAll(${JSON.stringify(frozen.selector)})].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=="hidden");if(found.length!==1)throw Error("ambiguous provider control");return found[0]})()`, objectGroup: 'nand-browser-operation' }));
				const objectId = text(record(found.result), 'objectId');
				if (found.exceptionDetails || !objectId) throw new BrowserError('browser_workspace_control_missing');
				const described = record(await this.send('DOM.describeNode', { objectId })), backendDOMNodeId = record(described.node).backendNodeId;
				if (typeof backendDOMNodeId !== 'number') throw new BrowserError('browser_workspace_control_missing');
				this.invalidate();
				const entry: RefEntry = { backendDOMNodeId, role: 'generic', name: '' }, element = '@provider';
				this.snapshot = { snapshot: '', refs: [{ ref: element, role: entry.role, name: entry.name }], refMap: new Map([[element, entry]]) };
				const revision = this.currentRevision();
				this.providerInputCheck = async (_method, params) => {
					await guard(); this.checkRevision({ revision });
					const valid = await this.call(objectId, entry, `function(x,y){if(!this.isConnected||this.disabled||this.getAttribute("aria-disabled")==="true")return false;const r=this.getBoundingClientRect();if(!r.width||!r.height)return false;return ${frozen.kind === 'click' ? 'this.contains(document.elementFromPoint(x,y))' : 'document.activeElement===this&&(x===undefined||this.contains(document.elementFromPoint(x,y)))'};}`, [params.x, params.y]);
					if (valid !== true) throw new BrowserError('browser_workspace_control_changed');
					admission();
				};
				admission(); await this.perform(frozen.kind, { revision, element, value: frozen.value }, signal); admission();
			} finally {
				this.providerInputCheck = undefined;
				if (!signal.aborted) { try { await this.send('Runtime.releaseObjectGroup', { objectGroup: 'nand-browser-operation' }); } catch { /* Guest closed. */ } }
			}
		});
	}
	private async resolve(
		params: Record<string, unknown>,
		key = 'element',
	): Promise<{ entry: RefEntry; objectId: string }> {
		if (!this.snapshot || params.revision !== this.currentRevision()) throw new BrowserError('browser_stale_ref');
		const entry = this.snapshot.refMap.get(text(params, key));
		if (!entry) throw new BrowserError('browser_stale_ref');
		try {
			const value = record(
				await this.send(
					'DOM.resolveNode',
					{ backendNodeId: entry.backendDOMNodeId, objectGroup: 'nand-browser-operation' },
					entry.sessionId,
				),
			);
			const objectId = text(record(value.object), 'objectId');
			if (!objectId) throw new Error();
			const connected = record(
				await this.send(
					'Runtime.callFunctionOn',
					{ objectId, functionDeclaration: 'function(){return this.isConnected}', returnByValue: true },
					entry.sessionId,
				),
			);
			if (!record(connected.result).value) throw new Error();
			return { entry, objectId };
		} catch {
			throw new BrowserError('browser_stale_ref');
		}
	}
	private async call(
		objectId: string,
		entry: RefEntry,
		functionDeclaration: string,
		values: unknown[] = [],
	): Promise<unknown> {
		const result = record(
			await this.send(
				'Runtime.callFunctionOn',
				{ objectId, functionDeclaration, arguments: values.map((value) => ({ value })), returnByValue: true },
				entry.sessionId,
			),
		);
		if (result.exceptionDetails) throw new BrowserError('browser_element_action_failed');
		return record(result.result).value;
	}
	private async point(
		params: Record<string, unknown>,
		key = 'element',
	): Promise<{ x: number; y: number; session?: string }> {
		const { entry, objectId } = await this.resolve(params, key);
		await this.send('DOM.scrollIntoViewIfNeeded', { backendNodeId: entry.backendDOMNodeId }, entry.sessionId);
		const box = record(
			await this.call(
				objectId,
				entry,
				'function(){const r=this.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}}',
			),
		);
		if (!box.width || !box.height) throw new BrowserError('browser_element_not_visible');
		return { x: Number(box.x), y: Number(box.y), session: entry.sessionId };
	}
	async execute(method: string, params: Record<string, unknown>, admission?: () => void): Promise<unknown> {
		if (method === 'stop') { admission?.(); this.page.stop(); return { ...this.page.state }; }
		return this.queue.run(async (signal) => {
			admission?.();
			await this.ensure();
			admission?.();
			const input = ['click', 'dblclick', 'hover', 'drag', 'fill', 'type', 'focus', 'select', 'check', 'keypress', 'reviewed'].includes(method);
			this.operationAdmission = admission;
			try {
				// Hidden Electron guests can acknowledge input without applying it. Reveal is an explicit caller action.
				if (input) {
					if (!this.page.webview.getBoundingClientRect().width) throw new BrowserError('browser_input_not_visible');
					this.page.webview.focus();
				}
				admission?.();
				if (method === 'review') return await this.reviewAction(params);
				if (method === 'reviewed') return await this.performReviewed(text(params, 'id'), signal, text(params, 'expectedOperation'));
				return await this.perform(method, params, signal);
			} finally {
				this.operationAdmission = undefined;
				this.providerInputCheck = undefined;
				if (!signal.aborted) {
					for (const session of [undefined, ...this.frames.values()]) {
						try {
							await this.send(
								'Runtime.releaseObjectGroup',
								{ objectGroup: 'nand-browser-operation' },
								session,
							);
						} catch {
							/* Guest navigated. */
						}
					}
				}
			}
		});
	}
	private async reviewAction(params: Record<string, unknown>): Promise<BrowserActionReview> {
		this.actionReview = undefined;
		const action = structuredClone(params.action) as BrowserReviewableAction;
		if (!action || !['click', 'keypress'].includes(action.kind) || !action.ref
			|| (action.kind === 'keypress' && (typeof action.key !== 'string' || action.key.length > 40)))
			throw new BrowserError('browser_invalid_argument');
		const { entry, objectId } = await this.resolve({ ...action.ref });
		const material = await this.call(objectId, entry, READ_ACTION_REVIEW) as Omit<BrowserActionReview, 'id' | 'target' | 'action' | 'expiresAt' | 'pageUrl'>;
		this.checkRevision({ ...action.ref });
		const review: BrowserActionReview = { ...material, id: crypto.randomUUID(), action,
			target: { pageId: this.page.state.id, profileId: this.page.profileId, generation: this.page.generation },
			expiresAt: Date.now() + 120_000, pageUrl: this.page.state.url };
		this.actionReview = { review, material: JSON.stringify(material) };
		return structuredClone(review);
	}
	private async performReviewed(id: string, signal: AbortSignal, expectedOperation: string): Promise<unknown> {
		const saved = this.actionReview;
		this.actionReview = undefined; // Consume before any await, including a failed attempt.
		if (!saved || saved.review.id !== id || Date.now() >= saved.review.expiresAt
			|| (expectedOperation && saved.review.action.kind !== expectedOperation))
			throw new BrowserError('browser_action_review_changed');
		const { review, material } = saved, params = { ...review.action.ref, ...('key' in review.action ? { key: review.action.key } : {}) };
		const { entry, objectId } = await this.resolve(params);
		const guard = async () => {
			this.operationAdmission?.(); this.checkRevision(params);
			if (Date.now() >= review.expiresAt || this.page.state.url !== review.pageUrl
				|| JSON.stringify(await this.call(objectId, entry, READ_ACTION_REVIEW)) !== material)
				throw new BrowserError('browser_action_review_changed');
			this.operationAdmission?.(); this.checkRevision(params);
		};
		await guard();
		this.providerInputCheck = async (_method, input) => {
			await guard();
			const valid = await this.call(objectId, entry, 'function(x,y){return this.isConnected&&(x===undefined?this.ownerDocument.activeElement===this:this.contains(this.ownerDocument.elementFromPoint(x,y)))}', [input.x, input.y]);
			if (valid !== true) throw new BrowserError('browser_action_review_changed');
		};
		await this.perform(review.action.kind, params, signal);
		return { operation: review.action.kind };
	}
	private async perform(method: string, params: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
		switch (method) {
			case 'snapshot': {
				this.revision++;
				const revision = this.revision;
				const snapshot = await buildSnapshot(
					(m, p) => this.send(m, p),
					this.frames,
					(sid) => (m, p) => this.send(m, p, sid),
				);
				if (revision !== this.revision) throw new BrowserError('browser_stale_ref');
				this.snapshot = snapshot;
				return {
					page: this.page.state.id,
					revision: this.currentRevision(),
					url: this.page.state.url,
					snapshot: snapshot.snapshot,
					refs: snapshot.refs,
				};
			}
			case 'goto':
				await this.page.navigate(text(params, 'url'));
				return { ...this.page.state };
			case 'back':
				await this.page.back();
				return { ...this.page.state };
			case 'forward':
				await this.page.forward();
				return { ...this.page.state };
			case 'reload':
				await this.page.reload(params.hard === true);
				return { ...this.page.state };
			case 'stop':
				this.page.stop();
				return { ...this.page.state };
			case 'screenshot':
				return { dataUrl: await this.screenshot(params.full === true) };
			case 'console':
				return this.consoleMessages.slice(-Math.min(100, numeric(params, 'limit', 50, 100)));
			case 'network':
				return this.networkFailures.slice(-Math.min(100, numeric(params, 'limit', 50, 100)));
			case 'viewport': {
				const width = numeric(params, 'width', 0, 7680),
					height = numeric(params, 'height', 0, 7680);
				if (!width || !height) await this.send('Emulation.clearDeviceMetricsOverride');
				else
					await this.send('Emulation.setDeviceMetricsOverride', {
						width,
						height,
						deviceScaleFactor: 1,
						mobile: false,
					});
				return { width, height };
			}
			case 'scroll': {
				const amount = numeric(params, 'amount', 600);
				const direction = text(params, 'direction') || 'down';
				if (!['up', 'down', 'left', 'right'].includes(direction))
					throw new BrowserError('browser_invalid_argument');
				await this.evaluate(
					`window.scrollBy(${JSON.stringify({ left: direction === 'left' ? -amount : direction === 'right' ? amount : 0, top: direction === 'up' ? -amount : direction === 'down' ? amount : 0, behavior: 'instant' })})`,
				);
				return { scrolled: amount };
			}
			case 'wait':
				return this.wait(params, signal);
			case 'click':
			case 'dblclick':
			case 'hover':
			case 'drag': {
				const point = await this.point(params, method === 'drag' ? 'from' : 'element');
				this.checkRevision(params);
				await this.send(
					'Input.dispatchMouseEvent',
					{ type: 'mouseMoved', x: point.x, y: point.y },
					point.session,
				);
				if (method === 'hover') return { hovered: true };
				const count = method === 'dblclick' ? 2 : 1;
				const target = method === 'drag' ? await this.point(params, 'to') : point;
				if (target.session !== point.session) throw new BrowserError('browser_cross_frame_drag_unsupported');
				for (let i = 1; i <= count; i++) {
					this.checkRevision(params);
					await this.send(
						'Input.dispatchMouseEvent',
						{ type: 'mousePressed', button: 'left', clickCount: i, x: point.x, y: point.y },
						point.session,
					);
					try {
						if (method === 'drag')
							await this.send(
								'Input.dispatchMouseEvent',
								{ type: 'mouseMoved', button: 'left', buttons: 1, x: target.x, y: target.y },
								target.session,
							);
					} finally {
						await this.send(
							'Input.dispatchMouseEvent',
							{ type: 'mouseReleased', button: 'left', clickCount: i, x: target.x, y: target.y },
							target.session,
						);
					}
				}
				return { performed: method };
			}
			case 'fill':
			case 'type':
			case 'focus':
			case 'select':
			case 'check':
			case 'get': {
				const { entry, objectId } = await this.resolve(params);
				const checkDraft = async () => {
					if (method !== 'fill' || !('expectedValue' in params)) return;
					if (typeof params.expectedValue !== 'string') throw new BrowserError('browser_invalid_argument');
					const current = await this.call(objectId, entry, READ_ELEMENT_VALUE) as { value?: string };
					if (current?.value !== params.expectedValue) throw new BrowserError('browser_workspace_draft_changed');
				};
				if (method === 'get')
					return this.call(
						objectId,
						entry,
						READ_ELEMENT_VALUE,
					);
				await checkDraft();
				await this.call(objectId, entry, 'function(){this.focus()}');
				this.checkRevision(params);
				if (method === 'fill' || method === 'type') {
					// DOM focus alone can leave Electron's input routing on a different visible guest.
					const point = await this.point(params);
					await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y }, point.session);
					if (await this.call(objectId, entry, 'function(x,y){const editable=this.isContentEditable||this.tagName==="TEXTAREA"||(this.tagName==="INPUT"&&!["button","checkbox","color","file","hidden","image","radio","range","reset","submit"].includes(this.type));return editable&&this.isConnected&&!this.disabled&&!this.readOnly&&this.contains(document.elementFromPoint(x,y))}', [point.x, point.y]) !== true)
						throw new BrowserError('browser_workspace_control_changed');
					this.checkRevision(params);
					await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: point.x, y: point.y }, point.session);
					try { this.checkRevision(params); }
					finally { await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: point.x, y: point.y }, point.session); }
				}
				if (method === 'fill')
					await this.call(
						objectId,
						entry,
						'function(){if(this.type==="file")throw Error("file input");if(this.isContentEditable){const r=document.createRange();r.selectNodeContents(this);const s=getSelection();s.removeAllRanges();s.addRange(r)}else if(this.select){this.select()}else throw Error("not editable")}',
					);
				if (method === 'type' || method === 'fill') {
					if (await this.call(objectId, entry, 'function(){return this.isConnected&&document.activeElement===this}') !== true)
						throw new BrowserError('browser_input_focus_changed');
					await checkDraft();
					await this.send(
						'Input.insertText',
						{ text: text(params, 'value') || text(params, 'input') },
						entry.sessionId,
					);
				}
				if (method === 'select')
					await this.call(
						objectId,
						entry,
						'function(value){if(this.tagName!=="SELECT")throw Error("not select");this.value=value;this.dispatchEvent(new Event("input",{bubbles:true}));this.dispatchEvent(new Event("change",{bubbles:true}))}',
						[text(params, 'value')],
					);
				if (method === 'check')
					await this.call(
						objectId,
						entry,
						'function(value){if(!["checkbox","radio"].includes(this.type))throw Error("not checkable");if(this.checked!==value)this.click()}',
						[params.checked !== false],
					);
				return { performed: method };
			}
			case 'keypress': {
				let session: string | undefined;
				if (params.element !== undefined) {
					const { entry, objectId } = await this.resolve(params);
					await this.call(objectId, entry, 'function(){this.focus()}');
					this.checkRevision(params);
					session = entry.sessionId;
				}
				const parts = text(params, 'key').split('+');
				const key = parts.pop() ?? '';
				const mask: Record<string, number> = { Alt: 1, Control: 2, Ctrl: 2, Meta: 4, Command: 4, Shift: 8 };
				if (parts.some((part) => !(part in mask))) throw new BrowserError('browser_invalid_argument');
				const modifiers = parts.reduce((value, part) => value | mask[part]!, 0);
				const codes: Record<string, number> = {
					Enter: 13,
					Tab: 9,
					Escape: 27,
					Backspace: 8,
					Delete: 46,
					ArrowLeft: 37,
					ArrowUp: 38,
					ArrowRight: 39,
					ArrowDown: 40,
					Space: 32,
					Home: 36,
					End: 35,
					PageUp: 33,
					PageDown: 34,
				};
				if (!codes[key] && key.length !== 1) throw new BrowserError('browser_invalid_argument');
				const code = codes[key] ?? key.toUpperCase().charCodeAt(0);
				await this.send('Input.dispatchKeyEvent', {
					type: 'keyDown',
					key: key === 'Space' ? ' ' : key,
					modifiers,
					windowsVirtualKeyCode: code,
					...(!modifiers && key === 'Enter'
						? { text: '\r' }
						: !modifiers && key.length === 1
							? { text: key }
							: {}),
				}, session);
				await this.send('Input.dispatchKeyEvent', {
					type: 'keyUp',
					key,
					modifiers,
					windowsVirtualKeyCode: code,
				}, session);
				return { key };
			}
			default:
				throw new BrowserError('browser_unknown_method', method);
		}
	}
	private async wait(params: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
		const until = Date.now() + numeric(params, 'timeout', 10000, 60000);
		if (!params.text && !params.url && !params.selector && !params.load)
			throw new BrowserError('browser_invalid_argument');
		if (params.load && !['load', 'domcontentloaded', 'networkidle'].includes(text(params, 'load')))
			throw new BrowserError('browser_invalid_argument');
		while (Date.now() < until) {
			if (signal.aborted) throw new BrowserError('browser_page_closed');
			const met = await this.evaluate(
				`(()=>{const p=${JSON.stringify(params)};return (!p.text||document.body?.innerText.includes(p.text))&&(!p.url||location.href.includes(p.url))&&(!p.selector||!!document.querySelector(p.selector))&&(!p.load||(p.load==='domcontentloaded'?document.readyState!=='loading':document.readyState==='complete'))})()`,
			);
			if (
				met &&
				(params.load !== 'networkidle' || (!this.requests.size && Date.now() - this.lastNetworkActivity >= 500))
			)
				return { matched: true };
			await new Promise<void>((resolve) => {
				const done = () => {
					this.page.webview.win.clearTimeout(timer);
					signal.removeEventListener('abort', done);
					resolve();
				};
				const timer = this.page.webview.win.setTimeout(done, 100);
				signal.addEventListener('abort', done, { once: true });
			});
		}
		throw new BrowserError('browser_timeout');
	}
	async screenshot(full = false): Promise<string> {
		// A hidden workbench page has no compositor surface; native capture otherwise waits until timeout.
		if (!this.page.webview.getBoundingClientRect().width) throw new BrowserError('browser_capture_not_visible');
		await this.ensure();
		const params: Record<string, unknown> = { format: 'png', captureBeyondViewport: full };
		if (full) {
			const metrics = record(await this.send('Page.getLayoutMetrics'));
			const size = record(metrics.cssContentSize ?? metrics.contentSize);
			if (
				Number(size.width) * Number(size.height) > 64_000_000 ||
				Number(size.width) > 16000 ||
				Number(size.height) > 30000
			)
				throw new BrowserError('browser_image_too_large');
			params.clip = {
				x: 0,
				y: 0,
				width: Number(size.width),
				height: Number(size.height),
				scale: 1,
			};
		}
		const result = record(await this.send('Page.captureScreenshot', params));
		return `data:image/png;base64,${String(result.data)}`;
	}
	async design(handler?: (grab: BrowserGrab) => void): Promise<void> {
		await this.ensure();
		this.designHandler = handler;
		await this.send('Overlay.enable');
		await this.send('Overlay.setInspectMode', {
			mode: handler ? 'searchForNode' : 'none',
			highlightConfig: {
				showInfo: true,
				contentColor: { r: 70, g: 140, b: 220, a: 0.2 },
				borderColor: { r: 70, g: 140, b: 220, a: 1 },
			},
		});
	}
	private async captureGrab(backendNodeId: number, session?: string): Promise<BrowserGrab> {
		await this.design();
		const result = record(await this.send('DOM.resolveNode', { backendNodeId }, session));
		const objectId = text(record(result.object), 'objectId');
		const grab = (await this.call(
			objectId,
			{ backendDOMNodeId: backendNodeId, role: '', name: '', sessionId: session },
			GRAB_ELEMENT_FUNCTION,
		)) as BrowserGrab;
		await this.send('Runtime.releaseObject', { objectId }, session);
		grab.screenshot = null;
		if (!session && grab.rect.width > 0 && grab.rect.height > 0) {
			const { x, y, width, height } = grab.rect;
			const zoom = this.page.webview.getZoomFactor();
			const left = Math.max(0, x),
				top = Math.max(0, y),
				right = Math.min(grab.viewport.width, x + width),
				bottom = Math.min(grab.viewport.height, y + height);
			if (right > left && bottom > top)
				grab.screenshot = (
					await this.guest.capturePage({
						x: Math.floor(left * zoom),
						y: Math.floor(top * zoom),
						width: Math.max(1, Math.ceil((right - left) * zoom)),
						height: Math.max(1, Math.ceil((bottom - top) * zoom)),
					})
				).toDataURL();
		}
		return grab;
	}
	dispose(): void {
		this.queue.close();
		for (const off of this.cleanups.splice(0)) off();
		this.release?.();
		this.frames.clear();
		this.requests.clear();
		this.consoleMessages.length = 0;
		this.networkFailures.length = 0;
		this.snapshot = undefined;
		this.designHandler = undefined;
		this.actionReview = undefined;
	}
}
