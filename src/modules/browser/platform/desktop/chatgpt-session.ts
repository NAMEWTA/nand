import { BrowserError } from '../../core/model';
import type { ProviderFactory } from '../../core/providers/contracts';
import { chatGptHistoryEndpoint, projectChatGptHistory } from '../../core/providers/chatgpt-history';
import { CHATGPT_DOM_READ } from './chatgpt-dom';
import { NativeProviderSession, type ProviderSessionPorts } from './provider-session';

export function chatGptProviderFactory(ports: ProviderSessionPorts): ProviderFactory {
 return { connect: async (binding, _taskId, signal) => {
  if (binding.provider !== 'chatgpt') throw new BrowserError('browser_workspace_provider_unsupported');
  return new NativeProviderSession(structuredClone(binding), ports, {
   provider: 'chatgpt', origin: 'https://chatgpt.com', domRead: CHATGPT_DOM_READ, version: 'nand-chatgpt',
   responses: { allow: chatGptHistoryEndpoint, project: projectChatGptHistory },
   history: (values, dom) => values.filter(history => history.conversationId === dom.conversationId).at(-1),
  }, signal);
 } };
}
