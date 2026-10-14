import { BrowserError, type BrowserGrab } from '../../core/model';
import { BrowserOperationQueue } from '../../core/operation-queue';
import { acquireDebugger } from './debugger-lease';
import { listenNative, type GuestContents } from './electron-api';
import type { BrowserPage } from './page';
import { buildSnapshot, type RefEntry, type SnapshotResult } from './snapshot-engine';
import { GRAB_ELEMENT_FUNCTION } from './grab-script';
import { READ_ELEMENT_VALUE } from './read-element';

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
	private snapshot?: SnapshotResult;
	private revision = 0;
	private readonly epoch = crypto.randomUUID();
	private currentRevision(): string {
		return `${this.epoch}:${this.revision}`;
	}
	private lost = false;
	private ready?: Promise<void>;
	private designHandler?: (grab: BrowserGrab) => void;
	readonly queue = new BrowserOperationQueue();
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
	async execute(method: string, params: Record<string, unknown>): Promise<unknown> {
		return this.queue.run(async signal => {
			await this.ensure();
			try { return await this.perform(method, params); }
			finally {
				if (!signal.aborted) for (const session of [undefined, ...this.frames.values()]) {
					try { await this.send('Runtime.releaseObjectGroup', { objectGroup: 'nand-browser-operation' }, session); }
					catch { /* Guest navigated. */ }
				}
			}
		});
	}
	private async perform(method: string, params: Record<string, unknown>): Promise<unknown> {
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
			case 'screenshot':
				return { dataUrl: await this.screenshot(params.full === true) };
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
			case 'get': {
				const { entry, objectId } = await this.resolve(params);
				return this.call(objectId, entry, READ_ELEMENT_VALUE);
			}
			default:
				throw new BrowserError('browser_unknown_method', method);
		}
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
		this.snapshot = undefined;
		this.designHandler = undefined;
	}
}
