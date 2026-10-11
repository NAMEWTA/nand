import { BrowserError } from '../../core/model';
import type { ProviderFactory } from '../../core/providers/contracts';
import { claudeHistory, claudeHistoryEndpoint, projectClaudeConversation } from '../../core/providers/claude-history';
import { CLAUDE_DOM_READ } from './claude-dom';
import { NativeProviderSession, type ProviderSessionPorts } from './provider-session';

export function claudeProviderFactory(ports: ProviderSessionPorts): ProviderFactory {
	return { connect: async (binding, _taskId, signal) => {
		if (binding.provider !== 'claude') throw new BrowserError('browser_workspace_provider_unsupported');
		return new NativeProviderSession(structuredClone(binding), ports, {
			provider: 'claude', origin: 'https://claude.ai', domRead: CLAUDE_DOM_READ, version: 'nand-claude',
			responses: { allow: claudeHistoryEndpoint, project: projectClaudeConversation },
			history: (values, dom) => {
				const value = values.filter(history => history.conversationId === dom.conversationId).at(-1);
				return value && claudeHistory(value, dom.messageIdentitiesComplete ? dom.messages.at(-1)?.id : undefined);
			},
		}, signal);
	} };
}
