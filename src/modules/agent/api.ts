import { serviceKey } from '../../app/contracts/module';
import type { PanelModel, WorkbenchTarget } from '../../app/contracts/workbench';
import type { AgentUsageSource } from './core/launch/usage-source';

export type { AgentUsageSource };

/** A running agent session that can receive material (browser selections, screenshots). */
export interface AgentSessionSummary {
	id: string;
	title: string;
}

/** Agent sessions as other modules see them (service `agent.sessions`). Material is pasted, never sent. */
export interface AgentSessionsPort {
	list(): Promise<AgentSessionSummary[]>;
	/** Paste `text` (and attach `files`) into the session's input as one unsent block. */
	attachMaterial(sessionId: string, material: { title: string; text: string; files: string[] }): Promise<void>;
}

export const AGENT_SESSIONS = serviceKey<AgentSessionsPort>('agent', 'sessions');

/** What the workbench shows for the agent module: its side panel, page title, statuses and usage. */
export interface AgentWorkbench {
	panel(target: WorkbenchTarget): PanelModel;
	title(target: WorkbenchTarget): string | undefined;
	/** Interactive agent sessions that are working or need input. */
	status(): ReadonlyArray<{ id: string; status: 'running' | 'waiting' }>;
	/** Provider quotas; `chips()` is the status bar text ("claude 42% · codex 80%"), empty when nothing is known. */
	usage(): { source: AgentUsageSource; pinned: boolean; chips: () => string };
	subscribe(listener: () => void): () => void;
}

export const AGENT_WORKBENCH = serviceKey<AgentWorkbench>('agent', 'workbench');
