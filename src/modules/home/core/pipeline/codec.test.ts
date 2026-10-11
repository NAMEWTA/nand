import { expect, test } from 'vitest';
import { parse, serialize } from '../board/parser';
import { readPipelineConfig } from './codec';

test('pipeline config persists without rewriting untouched source or unknown nested fields', () => {
	const raw = '---\r\ncustom: keep # comment\r\ncolumns:\r\n  - name: Flow\r\n    type: pipeline\r\n    pipeline:\r\n      rootFolder: Work\r\n      statusField: state\r\n      stages:\r\n        - id: draft\r\n          value: Draft\r\n          label: Draft\r\n          width: 300\r\n          custom: keep-stage\r\n      custom: keep-flow\r\n---\r\nFree introduction.\r\n## Flow\r\nSection prose.\r\n';
	const board = parse(raw); expect(board.columns[0]!.sectionType).toBe('pipeline');
	expect(serialize(board)).toBe(raw);
	board.columns[0]!.pipelineConfig!.stages[0]!.width = 420;
	const saved = serialize(board);
	expect(saved).toContain('custom: keep-stage'); expect(saved).toContain('custom: keep-flow'); expect(saved).toContain('custom: keep # comment');
	expect(saved).toContain('Section prose.\r\n');
	expect(parse(saved).columns[0]!.pipelineConfig!.stages[0]!.width).toBe(420);
	expect(serialize(parse(saved))).toBe(saved);
});

test('pipeline skills retain declared scope, stages and shared delivery settings', () => {
	const raw = { rootFolder: 'Work', skills: [{ id: 'review', label: 'Review', scope: 'stage', stages: ['Draft'], agentId: 'codex', skillName: 'review', promptTemplate: '{{paths}}', directSend: true, destination: { kind: 'existing', sessionId: 'live' } }] };
	const cfg = readPipelineConfig(raw);
	expect(cfg.skills).toEqual(raw.skills);
	expect(readPipelineConfig(JSON.parse(JSON.stringify(cfg)))).toEqual(cfg);
});
