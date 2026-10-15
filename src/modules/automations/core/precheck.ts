import type { AutomationDefinition } from '../../../shared/automation/types';

export const PRECHECK_TIMEOUT_MS = 60_000;
export interface PrecheckResult {
	exitCode: number | null;
	timedOut: boolean;
	output: string;
}
export type PrecheckRunner = (request: {
	precheck: NonNullable<AutomationDefinition['precheck']>;
	cwd?: string;
	signal: AbortSignal;
	timeoutMs: number;
}) => Promise<PrecheckResult>;
