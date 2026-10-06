export type ConnectionState = 'starting' | 'connected' | 'reconnecting' | 'disconnected' | 'exited' | 'failed';
export type AgentActivity = 'unknown' | 'running' | 'waiting' | 'idle' | 'exited';

export interface SessionStatusSnapshot {
	generation: number;
	connection: ConnectionState;
	agentActivity: AgentActivity;
	exitCode?: number;
	/** True only for a real agent session. A plain shell never borrows agent activity. */
	agent: boolean;
}

export function sessionStatusI18nKey(snapshot: SessionStatusSnapshot): string {
	if (snapshot.connection !== 'connected' || !snapshot.agent) return `workbench.connection.${snapshot.connection}`;
	if (snapshot.agentActivity === 'exited') return 'workbench.connection.exited';
	return `workbench.status.${snapshot.agentActivity}`;
}

export function sessionStatusClass(snapshot: SessionStatusSnapshot): string {
	if (snapshot.connection !== 'connected' || !snapshot.agent) return snapshot.connection;
	return snapshot.agentActivity === 'exited' ? 'exited' : snapshot.agentActivity;
}

/** Workbench "running" counts agent activity only, and only while the connection is up. */
export function runtimeActivity(snapshot: SessionStatusSnapshot): AgentActivity {
	if (!snapshot.agent || snapshot.connection !== 'connected') return 'unknown';
	return snapshot.agentActivity;
}
