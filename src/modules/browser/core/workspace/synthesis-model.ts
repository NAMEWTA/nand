import type { WorkspaceProvider } from '../providers/ids';
import type { SelectionSource } from './model';

export interface SynthesisInput {
	exchangeId: string; captureId: string; revision: number; turnId: string; sequence: number;
	provider: WorkspaceProvider; question: string; text: string; complete: boolean;
	source: 'provider-api' | 'native-copy' | 'scoped-dom' | 'user-selection'; url?: string; selection?: SelectionSource;
}
export type SynthesisDestination = { kind: 'automatic'; agentId: string }
	| { kind: 'existing'; agentId: string; sessionId: string; sessionTitle: string };
export type SynthesisStatus = 'pending' | 'running' | 'needs-attention' | 'succeeded' | 'pasted' | 'failed' | 'cancelled' | 'interrupted' | 'timeout';
/** An independent local result retains its exact source material even if its original task is deleted. */
export interface SynthesisRecord {
	id: string; taskId: string; taskTitle: string; title: string; instruction: string; prompt: string;
	inputs: SynthesisInput[]; destination: SynthesisDestination; createdAt: number; updatedAt: number;
	status: SynthesisStatus; text: string; terminalId?: string; errorCode?: string;
	usage?: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number | null; known: boolean; partial?: boolean };
}
