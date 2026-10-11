import { BrowserError } from '../../core/model';
import type { ProviderFactory } from '../../core/providers/contracts';
import { qwenHistoryEndpoint, projectQwenHistory } from '../../core/providers/qwen-history';
import { QWEN_DOM_READ } from './qwen-dom';
import { NativeProviderSession, type ProviderSessionPorts } from './provider-session';

export function qwenProviderFactory(ports: ProviderSessionPorts): ProviderFactory {
	return { connect: async (binding, _taskId, signal) => {
		if (binding.provider !== 'qwen') throw new BrowserError('browser_workspace_provider_unsupported');
		return new NativeProviderSession(structuredClone(binding), ports, {
			provider: 'qwen', origin: 'https://www.qianwen.com', domRead: QWEN_DOM_READ, version: 'nand-qwen',
			responses: { allow: qwenHistoryEndpoint, project: projectQwenHistory },
			history: (values, dom) => values.filter(history => history.conversationId === dom.conversationId).at(-1),
		}, signal);
	} };
}
