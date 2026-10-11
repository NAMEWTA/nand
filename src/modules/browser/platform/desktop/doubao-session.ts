import { BrowserError } from '../../core/model';
import type { ProviderFactory } from '../../core/providers/contracts';
import { doubaoHistory, doubaoHistoryEndpoint, projectDoubaoPage, projectDoubaoRequest } from '../../core/providers/doubao-history';
import { DOUBAO_DOM_READ } from './doubao-dom';
import { NativeProviderSession, type ProviderSessionPorts } from './provider-session';

export function doubaoProviderFactory(ports: ProviderSessionPorts): ProviderFactory {
	return { connect: async (binding, _taskId, signal) => {
		if (binding.provider !== 'doubao') throw new BrowserError('browser_workspace_provider_unsupported');
		return new NativeProviderSession(structuredClone(binding), ports, {
			provider: 'doubao', origin: 'https://www.doubao.com', domRead: DOUBAO_DOM_READ, version: 'nand-doubao',
			responses: { allow: doubaoHistoryEndpoint, requestIdentity: projectDoubaoRequest, project: projectDoubaoPage },
			history: (pages, dom) => dom.conversationId && dom.messageIdentitiesComplete
				? doubaoHistory(pages, dom.conversationId, dom.messages.at(-1)?.id) : undefined,
		}, signal);
	} };
}
