import { BrowserError } from '../../core/model';
import type { ProviderFactory } from '../../core/providers/contracts';
import { MINIMAX_DOM_READ } from './minimax-dom';
import { NativeProviderSession, type ProviderSessionPorts } from './provider-session';

export function minimaxProviderFactory(ports: ProviderSessionPorts): ProviderFactory {
	return { connect: async (binding, _taskId, signal) => {
		if (binding.provider !== 'minimax' || !binding.page) throw new BrowserError('browser_workspace_provider_unsupported');
		const origin = new URL(ports.page(binding.page).state.url).origin;
		if (!['https://agent.minimax.io', 'https://chat.minimax.io', 'https://agent.minimax.cn'].includes(origin)) throw new BrowserError('browser_workspace_identity_changed');
		if (binding.officialUrl && new URL(binding.officialUrl).origin !== origin) throw new BrowserError('browser_workspace_identity_changed');
		// Bind one actual host per session. A host switch requires a new explicit target check.
		return new NativeProviderSession(structuredClone(binding), ports, { provider: 'minimax', origin, domRead: MINIMAX_DOM_READ, version: 'nand-minimax' }, signal);
	} };
}
