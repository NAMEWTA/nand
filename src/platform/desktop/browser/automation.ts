import { BrowserError, type BrowserGrab } from '../../../core/browser/model';
import { BrowserOperationQueue } from '../../../core/browser/operation-queue';
import { acquireDebugger } from './debugger-lease';
import { listenNative, type GuestContents } from './electron-api';
import type { BrowserPage } from './page';
import { buildSnapshot, type RefEntry, type SnapshotResult } from './snapshot-engine';
import { GRAB_ELEMENT_FUNCTION } from './grab-script';

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
					this.consoleMessages.push({
						type: params.type,
						timestamp: params.timestamp,
						args: (Array.isArray(params.args) ? params.args : []).map((arg: unknown) => {
							const row = record(arg);
							return describe(row.value ?? row.description ?? '').slice(0, 2000);
						}),
					});
					if (this.consoleMessages.length > 100) this.consoleMessages.shift();
				}
				if (method === 'Network.loadingFailed') {
					this.networkFailures.push(params);
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
	async execute(method: string, params: Record<string, unknown>): Promise<unknown> {
		if (method === 'stop') { this.page.stop(); return { ...this.page.state }; }
		return this.queue.run(async (signal) => {
			await this.ensure();
			try {
				return await this.perform(method, params, signal);
			} finally {
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
				if (method === 'get')
					return this.call(
						objectId,
						entry,
						'function(){return {text:this.innerText||this.textContent,tag:this.tagName,attributes:Object.fromEntries([...this.attributes].filter(a=>!/^value$/i.test(a.name)).map(a=>[a.name,a.value]))}}',
					);
				await this.call(objectId, entry, 'function(){this.focus()}');
				this.checkRevision(params);
				if (method === 'fill')
					await this.call(
						objectId,
						entry,
						'function(){if(this.type==="file")throw Error("file input");if(this.isContentEditable){const r=document.createRange();r.selectNodeContents(this);const s=getSelection();s.removeAllRanges();s.addRange(r)}else if(this.select){this.select()}else throw Error("not editable")}',
					);
				if (method === 'type' || method === 'fill')
					await this.send(
						'Input.insertText',
						{ text: text(params, 'value') || text(params, 'input') },
						entry.sessionId,
					);
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
				});
				await this.send('Input.dispatchKeyEvent', {
					type: 'keyUp',
					key,
					modifiers,
					windowsVirtualKeyCode: code,
				});
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
		this.snapshot = undefined;
		this.designHandler = undefined;
	}
}
