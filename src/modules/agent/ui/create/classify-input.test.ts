import { expect, test } from 'vitest';
import { classifyInput, matchingAgents } from './classify-input';
import { AGENT_CATALOG } from '../../core/launch/catalog';
test.each([
	['claude', { kind: 'agent', agentId: 'claude-code' }],
	['Claude Code', { kind: 'agent', agentId: 'claude-code' }],
	['codex', { kind: 'agent', agentId: 'codex' }],
	['example.com', { kind: 'url', url: 'https://example.com/' }],
	['localhost:3000', { kind: 'url', url: 'http://localhost:3000/' }],
	['127.0.0.1:8080/x', { kind: 'url', url: 'http://127.0.0.1:8080/x' }],
	['a b', { kind: 'search', query: 'a b' }],
	['obsidian 插件 开发', { kind: 'search', query: 'obsidian 插件 开发' }],
	['?x', { kind: 'search', query: 'x' }],
	['?claude', { kind: 'search', query: 'claude' }],
	['', { kind: 'terminal' }],
	['   ', { kind: 'terminal' }],
	['c', { kind: 'search', query: 'c' }],
	['javascript:alert(1)', { kind: 'search', query: 'javascript:alert(1)' }],
	['https://', { kind: 'search', query: 'https://' }],
])('classifies %s', (input, expected) => {
	expect(classifyInput(input)).toEqual(expected);
});
test('matches only enabled catalog supplied by the caller, exact aliases before word prefixes', () => {
	expect(classifyInput('claude', [])).toEqual({ kind: 'search', query: 'claude' });
	expect(matchingAgents('cl', AGENT_CATALOG)[0]?.id).toBe('claude-code');
	expect(matchingAgents('c', AGENT_CATALOG)).toEqual([]);
	expect(classifyInput('mycli', [{ id: 'codex', title: 'Codex', command: 'mycli' }])).toEqual({
		kind: 'agent',
		agentId: 'codex',
	});
});
