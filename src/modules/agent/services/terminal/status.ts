import { t } from '../../../../shared/i18n/index';
import type { TerminalSession } from './session';

/** Connection state, or for agent sessions the agent's activity. */
export function statusLabel(session: TerminalSession): string {
	if (session.connection !== 'connected') return t(`agent.connection.${session.connection}`);
	if (!session.agentId) return t('agent.connection.connected');
	return t(`agent.activity.${session.activity}`);
}

/** Only native Hook events or process exit establish outcomes. Output silence is never completion. */
export function sessionState(
	session: TerminalSession,
	now = Date.now(),
): import('../../core/workspace/model').AgentState {
	if (session.connection === 'failed' || (session.connection === 'exited' && session.exitCode !== 0)) return 'failed';
	if (session.connection === 'disconnected') return 'interrupted';
	if (session.connection === 'exited') return now - session.activityAt > 30 * 60_000 ? 'idle' : 'done';
	if (session.activity === 'running') return 'working';
	if (session.activity === 'exited') return 'unknown';
	if (session.activity === 'done' && now - session.activityAt > 30 * 60_000) return 'idle';
	return session.activity;
}
