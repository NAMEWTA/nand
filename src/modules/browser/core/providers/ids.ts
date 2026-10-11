export const WORKSPACE_PROVIDERS = ['deepseek', 'kimi', 'chatgpt', 'claude', 'qwen', 'doubao', 'coze', 'minimax'] as const;
export type WorkspaceProvider = typeof WORKSPACE_PROVIDERS[number];
