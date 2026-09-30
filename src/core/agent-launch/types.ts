export type AgentId = keyof typeof import('./automation-catalog').AUTOMATION_AGENTS;

export type UsageKind =
	'claude' | 'codex' | 'grok' | 'gemini' | 'opencode' | 'kimi' | 'antigravity' | 'minimax' | 'none';

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

export interface PendingTerminalSession {
	agentId?: AgentId;
	shellType: string;
	shellArgs?: string[];
	cwd?: string;
	env?: Record<string, string>;
	title?: string;
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
