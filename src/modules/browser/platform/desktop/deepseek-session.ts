import { BrowserError } from '../../core/model';
import type { ProviderFactory } from '../../core/providers/contracts';
import { deepseekHistoryEndpoint, projectDeepSeekHistory } from '../../core/providers/deepseek-history';
import { DEEPSEEK_DOM_READ } from './deepseek-dom';
import { NativeProviderSession, type ProviderSessionPorts } from './provider-session';

export function deepseekProviderFactory(ports: ProviderSessionPorts): ProviderFactory {
 return { connect: async (binding, _taskId, signal) => {
  if (binding.provider !== 'deepseek') throw new BrowserError('browser_workspace_provider_unsupported');
  return new NativeProviderSession(structuredClone(binding), ports, {
   provider: 'deepseek', origin: 'https://chat.deepseek.com', domRead: DEEPSEEK_DOM_READ, version: 'nand-deepseek',
   responses: { allow: deepseekHistoryEndpoint, project: projectDeepSeekHistory },
   history: (values, dom) => values.filter(history => history.conversationId === dom.conversationId).at(-1),
  }, signal);
 } };
}
