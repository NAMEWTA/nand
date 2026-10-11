import { BrowserError } from '../../core/model';
import type { ProviderFactory } from '../../core/providers/contracts';
import { COZE_DOM_READ } from './coze-dom';
import { NativeProviderSession, type ProviderSessionPorts } from './provider-session';

export function cozeProviderFactory(ports: ProviderSessionPorts): ProviderFactory {
	return { connect: async (binding, _taskId, signal) => {
		if (binding.provider !== 'coze' || !binding.page) throw new BrowserError('browser_workspace_provider_unsupported');
		const origin = new URL(ports.page(binding.page).state.url).origin;
		if (!['https://www.coze.cn', 'https://coze.cn'].includes(origin)) throw new BrowserError('browser_workspace_identity_changed');
		if (binding.officialUrl && new URL(binding.officialUrl).origin !== origin) throw new BrowserError('browser_workspace_identity_changed');
		// Bind one actual host per session. A host switch requires a new explicit target check.
		return new NativeProviderSession(structuredClone(binding), ports, { provider: 'coze', origin, domRead: COZE_DOM_READ, version: 'nand-coze' }, signal);
	} };
}
