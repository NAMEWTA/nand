import { Bot } from 'lucide-react';
import { ClaudeIcon } from './agent-icons/ClaudeIcon';
import { OpenAIIcon } from './agent-icons/OpenAIIcon';
import { GeminiIcon } from './agent-icons/GeminiIcon';
export function AgentIcon({ agent, size = 14, className }: { agent: string; size?: number; className?: string }) {
	const Icon =
		agent === 'claude-code' || agent === 'claude'
			? ClaudeIcon
			: agent === 'codex'
				? OpenAIIcon
				: agent === 'gemini' || agent === 'gemini-cli'
					? GeminiIcon
					: Bot;
	return (
		<span role="img" aria-label={agent} className={className}>
			<Icon size={size} />
		</span>
	);
}
