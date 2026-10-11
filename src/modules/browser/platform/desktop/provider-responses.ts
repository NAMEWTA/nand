import { listenNative, type GuestContents } from './electron-api';
import type { ProviderRequestIdentity } from '../../core/providers/contracts';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
export interface ResponseScope<T> {
	/** Exact origin/endpoint. A string is URL conversation identity; true requires requestIdentity. */
	allow(url: URL): string | boolean | undefined;
	/** Projects a bounded allowlisted body immediately. Raw body, headers and credentials are never retained. */
	requestIdentity?(body: string, method: string): ProviderRequestIdentity | undefined;
	/** Runs through the bound guest's existing operation queue, with a generation admission check. */
	readBody(requestId: string): Promise<unknown>;
	/** Raw JSON is projected immediately. Headers, request bodies and tokens never enter retained state. */
	project(value: unknown, conversationId: string, request?: ProviderRequestIdentity): T | undefined;
	admit(): void;
	signal: AbortSignal;
}

/** A finite, passive observation scope. There is no fetch, credential replay, or global response cache. */
export class ProviderResponses<T> {
	private readonly pending = new Map<string, { conversationId: string; request?: ProviderRequestIdentity; order: number }>();
	private readonly requests = new Map<string, ProviderRequestIdentity>();
	private readonly responses: Array<{ order: number; value: T }> = [];
	private readonly off: () => void;
	private stopped = false;
	private serial = 0;
	private collecting = 0;
	private readonly aborted = () => this.dispose();
	constructor(guest: GuestContents, private readonly scope: ResponseScope<T>) {
		const offMessage = listenNative(guest.debugger, 'message', (_event, method, value, sessionId) => {
			if (this.stopped || sessionId) return;
			try { scope.admit(); } catch { this.dispose(); return; }
			const params = object(value), requestId = params.requestId;
			if (typeof requestId !== 'string') return;
			if (method === 'Network.requestWillBeSent' && scope.requestIdentity) {
				this.requests.delete(requestId);
				const request = object(params.request);
				try {
					if (typeof request.url !== 'string' || !scope.allow(new URL(request.url)) || typeof request.method !== 'string'
						|| typeof request.postData !== 'string' || request.postData.length > 16384) return;
					const projected = scope.requestIdentity(request.postData, request.method);
					if (!projected || typeof projected.conversationId !== 'string' || !projected.conversationId.length || projected.conversationId.length > 100
						|| (projected.cursor !== undefined && (typeof projected.cursor !== 'string' || projected.cursor.length > 1024))) return;
					if (this.requests.size >= 16) this.requests.delete(this.requests.keys().next().value!);
					this.requests.set(requestId, { conversationId: projected.conversationId, cursor: projected.cursor });
				} catch { /* Malformed request data provides no conversation identity. */ }
			}
			if (method === 'Network.responseReceived') {
				const response = object(params.response);
				const request = this.requests.get(requestId); this.requests.delete(requestId);
				this.pending.delete(requestId);
				if (typeof response.url !== 'string' || typeof response.status !== 'number' || response.status < 200 || response.status >= 300
					|| typeof response.mimeType !== 'string' || !/^application\/(?:[\w.+-]+\+)?json$/i.test(response.mimeType)) return;
				try {
					const allowed = scope.allow(new URL(response.url));
					const conversationId = allowed ? (scope.requestIdentity ? request?.conversationId : typeof allowed === 'string' ? allowed : undefined) : undefined;
					if (conversationId !== undefined) {
						if (this.pending.size >= 16) this.pending.delete(this.pending.keys().next().value!);
						this.pending.set(requestId, { conversationId, request, order: this.serial++ });
					}
				} catch { /* An invalid URL is not a provider endpoint. */ }
			}
			if (method === 'Network.loadingFailed') { this.pending.delete(requestId); this.requests.delete(requestId); }
			if (method === 'Network.loadingFinished') {
				const pending = this.pending.get(requestId); this.pending.delete(requestId);
				if (!pending || this.collecting >= 4 || typeof params.encodedDataLength !== 'number' || !Number.isFinite(params.encodedDataLength)
					|| params.encodedDataLength < 0 || params.encodedDataLength > 4 * 1024 * 1024) return;
				void this.collect(requestId, pending.conversationId, pending.order, pending.request);
			}
		});
		const offDetach = listenNative(guest.debugger, 'detach', () => this.dispose());
		this.off = () => { offMessage(); offDetach(); };
		scope.signal.addEventListener('abort', this.aborted, { once: true });
		if (scope.signal.aborted) this.dispose();
	}
	private async collect(requestId: string, conversationId: string, order: number, request?: ProviderRequestIdentity): Promise<void> {
		this.collecting++;
		try {
			this.scope.admit(); if (this.stopped) return;
			const result = object(await this.scope.readBody(requestId));
			this.scope.admit(); if (this.stopped || result.base64Encoded || typeof result.body !== 'string' || result.body.length > 4 * 1024 * 1024) return;
			const projected = this.scope.project(JSON.parse(result.body), conversationId, request);
			if (projected !== undefined) {
				this.responses.push({ order, value: structuredClone(projected) });
				this.responses.sort((a, b) => a.order - b.order);
				if (this.responses.length > 8) this.responses.shift();
			}
		} catch { /* Unavailable or malformed responses provide no acquisition evidence. */ }
		finally { this.collecting--; }
	}
	values(): T[] {
		if (this.stopped) return [];
		try { this.scope.admit(); } catch { this.dispose(); return []; }
		return this.responses.map(row => structuredClone(row.value));
	}
	dispose(): void {
		if (this.stopped) return;
		this.stopped = true; this.off(); this.scope.signal.removeEventListener('abort', this.aborted);
		this.pending.clear(); this.requests.clear(); this.responses.length = 0;
	}
}
