import { ModuleClient } from './module-client';
import type { ServerMessage } from './types';

export type NativeUsage = import('../../shared/automation/types').AgentUsage;
export interface NativeSession {
	key: string;
	agentId: string;
	accountKey: string;
	sessionId: string;
	cwd: string;
	title: string;
	transcriptPath: string;
	modifiedAtMs: number;
	text: string;
	usage: NativeUsage;
}
export interface HistoryPage {
	rows: NativeSession[];
	total: number;
	usage: NativeUsage;
}
export class AgentDataClient extends ModuleClient {
	private requests = new Map<
		string,
		{ resolve(value: unknown): void; reject(error: Error): void; cleanup(): void }
	>();
	constructor(private win: Window = window) {
		super('agent_data');
	}
	request<T>(
		operation: 'scan' | 'query' | 'read',
		payload: Record<string, unknown>,
		signal?: AbortSignal,
	): Promise<T> {
		if (!this.isConnected()) return Promise.reject(new Error('History service disconnected'));
		return new Promise<T>((resolve, reject) => {
			const requestId = crypto.randomUUID();
			const abort = () => {
				this.send('cancel', { requestId });
				this.requests.get(requestId)?.cleanup();
				this.requests.delete(requestId);
				reject(new Error('History request cancelled'));
			};
			const timeout = this.win.setTimeout(abort, 120_000);
			this.requests.set(requestId, {
				resolve: (value) => resolve(value as T),
				reject,
				cleanup: () => {
					this.win.clearTimeout(timeout);
					signal?.removeEventListener('abort', abort);
				},
			});
			signal?.addEventListener('abort', abort, { once: true });
			if (signal?.aborted) {
				abort();
				return;
			}
			this.send(operation, { ...payload, requestId });
		});
	}
	protected onMessage(message: ServerMessage): void {
		const id = typeof message.requestId === 'string' ? message.requestId : '';
		const pending = this.requests.get(id);
		if (!pending) return;
		this.requests.delete(id);
		pending.cleanup();
		if (typeof message.error === 'string') pending.reject(new Error(message.error));
		else pending.resolve(message.data);
	}
	override setWebSocket(ws: WebSocket | null): void {
		super.setWebSocket(ws);
		if (!ws) this.rejectPending();
	}
	private rejectPending(): void {
		for (const request of this.requests.values()) {
			request.cleanup();
			request.reject(new Error('History service disconnected'));
		}
		this.requests.clear();
	}
	override destroy(): void {
		this.rejectPending();
		super.destroy();
	}
}
