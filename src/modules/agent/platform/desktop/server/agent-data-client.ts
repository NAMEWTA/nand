export type NativeUsage = import('../../../../../shared/automation/types').AgentUsage;
export interface NativeSessionSummary {
	key: string;
	agentId: string;
	accountKey: string;
	sessionId: string;
	cwd: string;
	title: string;
	transcriptPath: string;
	modifiedAtMs: number;
	usage: NativeUsage;
}
export interface NativeSession extends NativeSessionSummary {
	text: string;
}
export interface HistoryPage {
	rows: NativeSessionSummary[];
	total: number;
	usage: NativeUsage;
	revision: number;
}

/** Native history requests served by the terminal helper (scan, query, read; cancelled by aborting). */
export interface HistoryClient {
	request<T>(operation: 'scan' | 'query' | 'read', payload: Record<string, unknown>, signal?: AbortSignal): Promise<T>;
	isConnected(): boolean;
	/** Changes whenever the helper process starts or stops; cached results from older revisions are stale. */
	readonly connectionRevision: number;
	subscribeConnection(listener: () => void): () => void;
}

/** Where the history service gets its client (the module's terminal sessions). */
export interface HistoryClientSource {
	historyClient(): HistoryClient | Promise<HistoryClient>;
}
