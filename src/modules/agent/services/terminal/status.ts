import { t } from '../../../../shared/i18n/index';
import type { TerminalSession } from './session';

/** Connection state, or for agent sessions the agent's activity. */
export function statusLabel(session: TerminalSession): string {
	if (session.connection !== 'connected') return t(`agent.connection.${session.connection}`);
	if (!session.agentId) return t('agent.connection.connected');
	return t(`agent.activity.${session.activity}`);
}
