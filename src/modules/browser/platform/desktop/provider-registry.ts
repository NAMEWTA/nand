import { BrowserError } from '../../core/model';
import type { ProviderFactory } from '../../core/providers/contracts';
import type { ProviderSessionPorts } from './provider-session';

/** Only implemented adapters are reachable; loading a task never opens or sends to a website. */
export function workspaceProviders(ports: ProviderSessionPorts): ProviderFactory {
 return { connect: async (binding, taskId, signal) => {
  const factory = binding.provider === 'deepseek' ? (await import('./deepseek-session')).deepseekProviderFactory
   : binding.provider === 'kimi' ? (await import('./kimi-session')).kimiProviderFactory
   : binding.provider === 'chatgpt' ? (await import('./chatgpt-session')).chatGptProviderFactory
   : binding.provider === 'claude' ? (await import('./claude-session')).claudeProviderFactory
   : binding.provider === 'qwen' ? (await import('./qwen-session')).qwenProviderFactory
   : binding.provider === 'doubao' ? (await import('./doubao-session')).doubaoProviderFactory
   : binding.provider === 'coze' ? (await import('./coze-session')).cozeProviderFactory
   : binding.provider === 'minimax' ? (await import('./minimax-session')).minimaxProviderFactory : undefined;
  if (!factory) throw new BrowserError('browser_workspace_provider_unsupported');
  const override = await ports.adapter?.(binding, taskId);
  return factory({ ...ports, override }).connect(binding, taskId, signal);
 } };
}
