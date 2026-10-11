import { contributionPoint, serviceKey } from '../../app/contracts/module';
import type { PanelModel, WorkbenchTarget } from '../../app/contracts/workbench';
import type { AgentUsageSource } from './core/launch/usage-source';
import type { AgentId } from './core/launch/types';
import type { AgentDispatchRequest, AgentDispatchReceipt } from '../../shared/agent-dispatch';
import type { AgentSkillCapability } from '../../shared/agent-prompt';
import type { SkillEntry, SkillScan, SkillSource } from './core/skills/registry';

export type { AgentId, AgentUsageSource };
export type { AgentDispatchRequest, AgentDispatchReceipt };
export type { AgentSkillCapability, SkillEntry, SkillScan, SkillSource };

/** Read-only discovery runs only when a picker or explicit refresh requests it. */
export interface AgentSkills {
	targets(): readonly Pick<AgentDirectoryEntry, 'id' | 'title'>[];
	capability(agentId: string): AgentSkillCapability | undefined;
	list(agentId: string, signal?: AbortSignal): Promise<SkillScan>;
	/** Call only after the user's button configuration has been saved. */
	remember(agentId: string, name: string): Promise<void>;
	forget(agentId: string, name: string): Promise<void>;
}
export const AGENT_SKILLS = serviceKey<AgentSkills>('agent', 'skills');

export interface AgentDirectoryEntry { id: AgentId; title: string; enabled: boolean; installed: boolean; }
export interface AgentDirectory { list(): readonly AgentDirectoryEntry[]; }
export const AGENT_DIRECTORY = serviceKey<AgentDirectory>('agent', 'directory');

/** A running agent session that can receive material (browser selections, screenshots). */
export interface AgentSessionSummary {
	id: string;
	title: string;
	agentId?: AgentId;
}

/** Agent sessions as other modules see them (service `agent.sessions`). Material is pasted, never sent. */
export interface AgentSessionsPort {
	list(): Promise<AgentSessionSummary[]>;
	/** Paste `text` (and attach `files`) into the session's input as one unsent block. */
	attachMaterial(sessionId: string, material: { title: string; text: string; files: string[] }, options?: { agentId?: AgentId; signal?: AbortSignal }): Promise<void>;
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

export type AgentPromptStatus = 'succeeded' | 'failed' | 'cancelled' | 'interrupted' | 'timeout';

/** One authorized prompt run. Text is exclusively the complete native answer. */
export interface AgentPromptResult {
	status: AgentPromptStatus;
	text: string;
	agentId?: AgentId;
	/** Hash of the native account identity; never an environment or credential map. */
	accountIdentity?: string;
	terminalId?: string;
	errorCode?: string;
	usage?: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number | null; known: boolean; partial?: boolean };
}

export interface AgentPromptRequest {
	prompt: string;
	purpose: string;
	agentId?: AgentId;
	/** Defaults to the vault root. Every supplied cwd must resolve within it. */
	cwd?: string;
	timeoutMs?: number;
	signal?: AbortSignal;
	reveal?: boolean;
	keepTerminal?: boolean;
	/** Continue a successful retained prompt terminal, e.g. one format repair. */
	continueTerminalId?: string;
	/** Full native lifecycle answer, never terminal screen text. */
	resultChannel?: 'native';
	runContext?: { provider: string; handle: string };
	onState?: (state: { status: 'running' | 'needs-attention'; terminalId: string }) => void;
}

export interface AgentPromptRunner {
	run(request: AgentPromptRequest): Promise<AgentPromptResult>;
	/** Open a terminal owned by this runner, e.g. to answer a CLI permission prompt. */
	open?(terminalId: string): Promise<void>;
	/** End a retained terminal when its consuming module is disabled. */
	close?(terminalId: string): Promise<void>;
}

export const AGENT_PROMPT_RUNNER = serviceKey<AgentPromptRunner>('agent', 'prompt-runner');

export interface AgentRunContextLease {
	/** Short-lived grants only. Never stored in account/session identity or receipts. */
	env: Readonly<Record<string, string>>;
	dispose(): void | Promise<void>;
}
export interface AgentRunContextProvider {
	id: string;
	resolve(handle: string, run: { runId: string; cwd: string; signal: AbortSignal }): Promise<AgentRunContextLease | undefined>;
}
export const AGENT_RUN_CONTEXTS = contributionPoint<AgentRunContextProvider>('agent', 'run-contexts');

/** Deliver once through the shared journal. Fresh starts the selected CLI; existing only pastes. */
export interface AgentDispatch {
	dispatch(request: AgentDispatchRequest, options?: { signal?: AbortSignal }): Promise<AgentDispatchReceipt>;
}

export const AGENT_DISPATCH = serviceKey<AgentDispatch>('agent', 'dispatch');
