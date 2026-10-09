export type AgentId = 'claude-code' | 'codex' | 'grok' | 'opencode' | 'gemini' | 'pi';

export type UsageKind = 'claude' | 'codex' | 'grok' | 'gemini' | 'opencode' | 'none';

export type PermissionMode = 'yolo' | 'manual';

export type AgentPermissionMode = 'inherit' | PermissionMode;

export interface AgentEntrySettings {
	enabled: boolean;
	cliPath: string;
	permissionMode: AgentPermissionMode;
	extraArgs: string;
	accountId: string;
	showUsage: boolean;
}

export interface AgentSettings {
	globalPermissionMode: PermissionMode;
	yoloAcknowledged: boolean;
	usageRefreshSec: number;
	showUsageInStatusBar: boolean;
	agents: Record<AgentId, AgentEntrySettings>;
}

export interface UsageWindow {
	name: string;
	usedPct: number | null;
	resetAt: string | null;
}

export type UsageStatusKey = 'quotaUnsupported' | 'notSignedIn' | 'expired' | 'readOk' | 'noNumbers' | 'readFailed';

export interface UsageSnapshot {
	checkedAt?: number;
	stale?: boolean;
	source?: string;
	agentId: AgentId;
	provider: string;
	account: string | null;
	status: string;
	/** Known local states are translated when displayed; provider errors retain their original text. */
	statusKey?: UsageStatusKey;
	failed: boolean;
	windows: UsageWindow[];
}
