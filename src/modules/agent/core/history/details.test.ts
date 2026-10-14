import { expect, test } from 'vitest';
import { transcriptDetails, withinVault } from './details';
test('retains full first prompt, parses native providers and tolerates interrupted JSONL', () => {
	const prompt = 'Full prompt\n' + 'context '.repeat(100);
	const result = transcriptDetails(
		[
			JSON.stringify({
				type: 'user',
				timestamp: '2026-10-01T10:00:00Z',
				message: { role: 'user', content: [{ type: 'text', text: prompt }] },
			}),
			JSON.stringify({
				type: 'assistant',
				message: { role: 'assistant', model: 'opus', content: [{ type: 'text', text: 'Done' }] },
			}),
			'{"interrupted":',
		].join('\n'),
	);
	expect(result.firstPrompt).toBe(prompt);
	expect(result.model).toBe('opus');
	expect(result.messageCount).toBe(2);
	expect(result.turns.at(-1)?.text).toBe('Done');
	expect(
		transcriptDetails(
			JSON.stringify({
				messages: [
					{ type: 'user', content: 'Question' },
					{ type: 'gemini', content: 'Answer', model: 'gemini' },
				],
			}),
		),
	).toMatchObject({ firstPrompt: 'Question', model: 'gemini', messageCount: 2 });
	expect(
		transcriptDetails(
			[
				JSON.stringify({ type: 'response_item', payload: { role: 'user', content: [{ text: 'Hi' }] } }),
				JSON.stringify({ type: 'event_msg', payload: { type: 'user_message', message: 'Hi' } }),
			].join('\n'),
		).messageCount,
	).toBe(1);
});
test('vault scope checks path segments rather than text prefixes', () => {
	expect(withinVault('/vault/a', '/vault/')).toBe(true);
	expect(withinVault('/vault-else', '/vault')).toBe(false);
	expect(withinVault('C:\\vault\\a', 'C:\\vault')).toBe(true);
	expect(withinVault('/vault', '')).toBe(false);
});

test.each(['function_call_output', 'custom_tool_call_output'])('preserves Codex %s output as a tool turn', (type) => {
	const details = transcriptDetails(
		JSON.stringify({
			type: 'response_item',
			payload: { type, output: { content: [{ type: 'text', text: 'Tool output' }] } },
		}),
	);
	expect(details).toMatchObject({ firstPrompt: '', messageCount: 1, turns: [{ role: 'tool', text: 'Tool output' }] });
});
test('normalizes Pi toolResult and Claude tool_result before prompt selection and deduplication', () => {
	const rows = [
		{ type: 'message', message: { role: 'toolResult', content: [{ type: 'text', text: 'Pi result' }] } },
		{
			type: 'user',
			message: {
				role: 'user',
				content: [{ type: 'tool_result', content: [{ type: 'text', text: 'Claude result' }] }],
			},
		},
		{
			type: 'user',
			message: {
				role: 'user',
				content: [
					{ type: 'text', text: 'Question' },
					{ type: 'text', text: 'continued' },
					{ type: 'tool_result', content: 'Second result' },
					{ type: 'text', text: 'Follow up' },
				],
			},
		},
		{ type: 'response_item', payload: { type: 'message', role: 'user', content: 'Follow up' } },
		{ type: 'event_msg', payload: { type: 'user_message', message: 'Follow up' } },
		{ type: 'assistant', message: { role: 'assistant', content: 'Answer' } },
	];
	const details = transcriptDetails(rows.map((row) => JSON.stringify(row)).join('\n'));
	expect(details.firstPrompt).toBe('Question\ncontinued');
	expect(details.turns).toEqual([
		{ role: 'tool', text: 'Pi result' },
		{ role: 'tool', text: 'Claude result' },
		{ role: 'user', text: 'Question\ncontinued' },
		{ role: 'tool', text: 'Second result' },
		{ role: 'user', text: 'Follow up' },
		{ role: 'assistant', text: 'Answer' },
	]);
	expect(details.messageCount).toBe(6);
});

test('reads the helper normalized Markdown fallback without losing a multiline first prompt', () => {
	const result = transcriptDetails('\n## user\n\nFirst line\nSecond line\n\n## assistant\n\nDone\n');
	expect(result.firstPrompt).toBe('First line\nSecond line');
	expect(result.messageCount).toBe(2);
});
