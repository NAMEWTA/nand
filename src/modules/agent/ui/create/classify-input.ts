// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/tab-bar/tab-agent-launch-options.ts
import { AGENT_CATALOG } from '../../core/launch/catalog';
import type { AgentId } from '../../core/launch/types';
export interface AgentOption {
	id: AgentId;
	title: string;
	command?: string;
}
export type InputAction =
	| { kind: 'terminal' }
	| { kind: 'browser' }
	| { kind: 'agent'; agentId: AgentId }
	| { kind: 'url'; url: string }
	| { kind: 'search'; query: string };
export function matchingAgents(input: string, agents: readonly AgentOption[]): AgentOption[] {
	const q = input.trim().toLocaleLowerCase();
	if (!q || q.startsWith('?')) return [];
	const score = (agent: AgentOption) => {
		const aliases = [
			agent.id,
			agent.title,
			agent.command ?? '',
			AGENT_CATALOG.find((a) => a.id === agent.id)?.detectCommand ?? '',
		].map((s) => s.toLocaleLowerCase());
		if (aliases.includes(q)) return 2;
		return q.length > 1 && aliases.some((alias) => alias.split(/[\s/-]+/).some((word) => word.startsWith(q)))
			? 1
			: 0;
	};
	return agents.filter((a) => score(a)).sort((a, b) => score(b) - score(a));
}
export function classifyInput(input: string, agents: readonly AgentOption[] = AGENT_CATALOG): InputAction {
	const q = input.trim();
	if (!q) return { kind: 'terminal' };
	if (q.startsWith('?')) return { kind: 'search', query: q.slice(1).trim() };
	if (/^(terminal|shell|终端)$/i.test(q)) return { kind: 'terminal' };
	if (/^(browser|web|浏览器)$/i.test(q)) return { kind: 'browser' };
	const agent = matchingAgents(q, agents)[0];
	if (agent) return { kind: 'agent', agentId: agent.id };
	if (/^https?:\/\//i.test(q)) {
		try {
			return { kind: 'url', url: new URL(q).href };
		} catch {
			return { kind: 'search', query: q };
		}
	}
	if (!/\s/.test(q) && /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(q)) {
		try {
			return { kind: 'url', url: new URL(`http://${q}`).href };
		} catch {
			return { kind: 'search', query: q };
		}
	}
	if (!/\s/.test(q) && /^(?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]{2,}(?::\d+)?(?:[/?#]|$)/u.test(q)) {
		try {
			return { kind: 'url', url: new URL(`https://${q}`).href };
		} catch {
			return { kind: 'search', query: q };
		}
	}
	return { kind: 'search', query: q };
}
