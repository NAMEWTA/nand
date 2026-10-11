import type { WorkspaceProvider } from './ids';

/** Return only an exact official origin. Callers can discard arbitrary queries and credentials. */
export function officialWorkspaceOrigin(provider: WorkspaceProvider, value: string): string | undefined {
	try {
		const url = new URL(value), home = officialConversationUrl(provider);
		if (!home || url.protocol !== 'https:' || url.username || url.password) return undefined;
		const allowed = [new URL(home).origin, ...(provider === 'coze' ? ['https://coze.cn']
			: provider === 'minimax' ? ['https://chat.minimax.io', 'https://agent.minimax.cn'] : [])];
		return allowed.includes(url.origin) ? url.origin : undefined;
	} catch { return undefined; }
}

/** Persist provider-owned conversation links, never a login redirect or arbitrary page query string. */
export function officialConversationUrl(provider: WorkspaceProvider, conversationId?: string): string | undefined {
	if (conversationId !== undefined && !/^[\w-]{1,100}$/.test(conversationId)) return undefined;
	if (provider === 'kimi') return conversationId ? `https://www.kimi.com/chat/${conversationId}` : 'https://www.kimi.com/';
	if (provider === 'chatgpt') return conversationId ? `https://chatgpt.com/c/${conversationId}` : 'https://chatgpt.com/';
	if (provider === 'claude') return conversationId ? `https://claude.ai/chat/${conversationId}` : 'https://claude.ai/';
	if (provider === 'qwen') return conversationId ? `https://www.qianwen.com/conversation/${conversationId}` : 'https://www.qianwen.com/';
	if (provider === 'doubao') return conversationId ? `https://www.doubao.com/chat/${conversationId}` : 'https://www.doubao.com/chat/';
	// No verified website permalink contract: retain exact captured page identity instead of inventing a route.
	if (provider === 'coze') return conversationId === undefined ? 'https://www.coze.cn/' : undefined;
	if (provider === 'minimax') return conversationId === undefined ? 'https://agent.minimax.io/' : undefined;
	if (provider !== 'deepseek') return undefined;
	return conversationId ? `https://chat.deepseek.com/a/chat/s/${conversationId}` : 'https://chat.deepseek.com/';
}
