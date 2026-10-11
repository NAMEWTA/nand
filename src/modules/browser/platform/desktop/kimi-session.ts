import { BrowserError } from '../../core/model';
import type { ProviderFactory } from '../../core/providers/contracts';
import { kimiHistory, kimiHistoryEndpoint, projectKimiPage, projectKimiRequest } from '../../core/providers/kimi-history';
import { KIMI_DOM_READ } from './kimi-dom';
import { NativeProviderSession, type ProviderSessionPorts } from './provider-session';

export function kimiProviderFactory(ports: ProviderSessionPorts): ProviderFactory {
 return { connect: async (binding, _taskId, signal) => {
  if (binding.provider !== 'kimi') throw new BrowserError('browser_workspace_provider_unsupported');
  return new NativeProviderSession(structuredClone(binding), ports, {
   provider: 'kimi', origin: 'https://www.kimi.com', domRead: KIMI_DOM_READ, version: 'nand-kimi',
   responses: { allow: kimiHistoryEndpoint, requestIdentity: projectKimiRequest, project: projectKimiPage },
   history: (pages, dom) => dom.conversationId && dom.messageIdentitiesComplete
    ? kimiHistory(pages, dom.conversationId, dom.messages.at(-1)?.id) : undefined,
  }, signal);
 } };
}
