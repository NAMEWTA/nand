import type { AgentId } from './types';
import type { VaultSession } from '../ai-vault/types';

export interface ContextMaterial {
	id: string;
	kind: 'web' | 'element' | 'screenshot' | 'note' | 'archive';
	title: string;
	text: string;
	files?: string[];
	source?: string;
}
export interface AgentSessionSnapshot {
	id: string;
	agent: AgentId;
	title: string;
	cwd: string;
	status: 'unknown' | 'running' | 'waiting' | 'idle' | 'exited';
}
/** Execution owns identity/status. A presentation can be closed without stopping a session. */
export interface AgentSessionApi {
	snapshot(): readonly AgentSessionSnapshot[];
	subscribe(listener: () => void): () => void;
	start(agent: AgentId): Promise<void>;
	resume(session: VaultSession): Promise<void>;
	stop(id: string): Promise<void>;
	open(id: string): Promise<void>;
	attach(id: string, materials: readonly ContextMaterial[], signal?: AbortSignal): Promise<void>;
}
