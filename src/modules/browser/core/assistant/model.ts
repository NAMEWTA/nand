import type { BrowserPageTarget } from '../control';
import type { ScopedBrowserOperation } from '../scoped-grant';
import type { SynthesisDestination } from '../workspace/synthesis-model';

export interface AssistantStep {
	id: string;
	target: BrowserPageTarget;
	operation: ScopedBrowserOperation;
	startedAt: number;
	finishedAt?: number;
	state: 'running' | 'confirming' | 'returned' | 'denied' | 'failed' | 'unknown';
	errorCode?: string;
	/** Native return and an observation are evidence, never proof that a website accepted a submission. */
	evidence?: string;
}
export type AssistantStatus = 'pending' | 'running' | 'needs-attention' | 'confirming' | 'paused' | 'succeeded' | 'pasted' | 'failed' | 'cancelled' | 'interrupted' | 'timeout';
export interface AssistantTask {
	id: string;
	title: string;
	goal: string;
	prompt: string;
	pages: Array<{ target: BrowserPageTarget; title: string; url: string; accountLabel: string }>;
	operations: ScopedBrowserOperation[];
	maxOperations: number;
	timeoutMs: number;
	destination: SynthesisDestination;
	createdAt: number;
	updatedAt: number;
	status: AssistantStatus;
	steps: AssistantStep[];
	text: string;
	terminalId?: string;
	errorCode?: string;
	/** Explicit continuation creates a new bounded owner run, without silently replaying the old task. */
	previousTaskId?: string;
	usage?: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number | null; known: boolean; partial?: boolean };
}
export interface AssistantData { version: 1; tasks: AssistantTask[] }
export const emptyAssistant = (): AssistantData => ({ version: 1, tasks: [] });
export interface AssistantRequest {
	title: string; goal: string; targets: BrowserPageTarget[]; operations: ScopedBrowserOperation[];
	maxOperations: number; timeoutMs: number; destination: SynthesisDestination; previousTaskId?: string;
}
