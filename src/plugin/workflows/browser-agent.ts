import { BrowserError, type BrowserAgentDeliveryPort } from '../../core/browser/model';
import { agentSessions } from './agent-sessions';
import { t } from '../../shared/i18n';
import type { TerminalAgentController } from '../modules/terminal';

/** Only explicit Agent sessions receive material, always as unsent bracketed paste. */
export function createBrowserAgentDelivery(read: () => TerminalAgentController | undefined): BrowserAgentDeliveryPort {
	return {
		async list() {
			const host = read();
			if (!host?.isActive()) return [];
			return (await agentSessions(host)).snapshot().map(session => ({ id: session.id, title: session.title }));
		},
		async attach(id, text, files) {
			const host = read();
			if (!host?.isActive()) throw new BrowserError('browser_agent_unavailable');
			await (await agentSessions(host)).attach(id, [{ id: crypto.randomUUID(), kind: 'web', title: t('browser.contextMaterial'), text, files }]);
		},
	};
}
