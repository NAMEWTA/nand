export interface AgentUsage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number | null;
	known: boolean;
	partial?: boolean;
}
export type NotificationChannelId = 'in-app' | 'system';
export type ScheduleSpec =
	{ kind: 'manual' } | { kind: 'once'; at: number } | { kind: 'recurring'; expression: string; start: number; timezone?: string };
export interface SourceRef {
	kind: 'dashboard' | 'contacts' | 'widget';
	path: string;
	id: string;
}
export interface AgentSessionRef {
	agentId: string;
	sessionId: string;
	cwd: string;
	title: string;
	modifiedAtMs: number;
	accountKey: string;
	transcriptPath?: string;
	terminalId?: string;
}
export type AutomationAction =
	| { kind: 'script'; script: string; cwd: string; shell: 'powershell' | 'bash' }
	| { kind: 'obsidian-command'; command: string }
	| { kind: 'open-file'; path: string }
	| { kind: 'open-url'; url: string }
	| { kind: 'notify'; body: string }
	| { kind: 'create-task'; path: string; cardId: string; text: string }
	| {
			kind: 'agent';
			agentId: string;
			cwd: string;
			prompt: string;
			sessionMode: 'fresh' | 'reuse' | 'specific';
			session?: AgentSessionRef;
	  };
export interface AutomationDefinition {
	id: string;
	name: string;
	enabled: boolean;
	deviceId: string;
	revision: number;
	schedule: ScheduleSpec;
	action: AutomationAction;
	channels: NotificationChannelId[];
	notifyOn: 'always' | 'failure' | 'never';
	graceMinutes: number;
	source?: SourceRef;
	createdAt: number;
	updatedAt: number;
}
export type RunStatus =
	'pending' | 'running' | 'unknown' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted' | 'skipped';
export interface AutomationMessage {
	message: string;
	errorCode?: string;
	errorParams?: Record<string, string | number>;
}
export interface AutomationRun extends AutomationMessage {
	definition?: AutomationDefinition;
	notificationAttempted?: boolean;
	id: string;
	automationId: string;
	revision: number;
	title: string;
	scheduledFor: number;
	trigger: 'manual' | 'scheduled';
	status: RunStatus;
	startedAt: number;
	endedAt?: number;
	usage?: AgentUsage;
	output?: string;
	terminalId?: string;
	session?: AgentSessionRef;
	source?: SourceRef;
}
export interface AgentDescription {
	id: string;
	title: string;
	enabled: boolean;
	installed?: boolean;
}
export interface AgentRunHandle {
	onRunning?(listener: () => void): () => void;
	terminalId: string;
	session?: AgentSessionRef;
	completion: Promise<{
		status: 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
		message: string;
		errorCode?: string;
		errorParams?: Record<string, string | number>;
		output?: string;
		usage?: AgentUsage;
		session?: AgentSessionRef;
	}>;
}
export interface AgentRuntimePort {
	startScript?(action: Extract<AutomationAction, { kind: 'script' }>, run: AutomationRun): Promise<AgentRunHandle>;
	listAgents(): AgentDescription[];
	listSessions(cwd: string): Promise<AgentSessionRef[]>;
	start(
		action: Extract<AutomationAction, { kind: 'agent' }>,
		run: AutomationRun,
		previous?: AutomationRun,
	): Promise<AgentRunHandle>;
	stop(terminalId: string): Promise<void>;
	open(terminalId: string): Promise<void>;
}
export interface AutomationSourcePort {
	list(): Promise<AutomationDefinition[]>;
	save(definition: AutomationDefinition): Promise<void>;
	remove(definition: AutomationDefinition): Promise<void>;
	open(source: SourceRef): Promise<void>;
	createTask(action: Extract<AutomationAction, { kind: 'create-task' }>, runId: string): Promise<void>;
}
export interface AutomationUiPort {
	actions?(): Array<{ id: string; name: string; status?: string; running: boolean; unavailable?: string }>;
	subscribe?(listener: () => void): () => void;
	runAction?(id: string): Promise<void>;
	stopAction?(id: string): Promise<void>;
	openAction?(id: string): Promise<void>;
	edit(source?: SourceRef, title?: string, existing?: AutomationDefinition): void;
	open(): Promise<void>;
}
export function isActiveRun(run: AutomationRun): boolean {
	return run.status === 'pending' || run.status === 'running' || run.status === 'unknown';
}
