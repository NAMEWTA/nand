import { expect, test } from 'vitest';
import { analysisAnswer, analysisRow, promptMaterialIds } from '../../../../test/news/analysis';
import { analysisBatches, runMaterialAnalysis, type AnalysisCall } from './analysis-run';
import { upsertMaterial } from './materials';

const materials = await Promise.all(Array.from({ length: 25 }, (_, index) => upsertMaterial(undefined, { sourceId: 'test', url: `https://example.com/${index}`, title: `Item ${index}`, summary: 'Fact' })));

test('batches are serial, bounded by count and serialized CLI input; no-op and new interest reuse completed revisions', async () => {
	const calls: AnalysisCall[] = [];
	const closed: string[] = [];
	const runner = {
		run: async (prompt: string, call: AnalysisCall) => {
			calls.push(call);
			return { status: 'succeeded' as const, terminalId: `terminal-${calls.length}`, text: analysisAnswer(promptMaterialIds(prompt).map(id => analysisRow(id))) };
		}, close: async (id: string) => { closed.push(id); },
	};
	const result = await runMaterialAnalysis(materials, [], runner, 20);
	expect(calls.map(call => call.materials.length)).toEqual([12, 12, 1]);
	expect(result).toMatchObject({ status: 'complete', calls: 3 });
	expect(result.analyses).toHaveLength(25);
	expect(closed).toHaveLength(3);
	expect(analysisBatches(materials.map(item => ({ ...item, title: 'x'.repeat(8000) })), {})).toHaveLength(13);
	const again = await runMaterialAnalysis(materials, result.analyses, runner, 20, 3, Date.now(), { interest: 'new interest' });
	expect(again.calls).toBe(0);
	expect(calls).toHaveLength(3);
});

test('repair gets one same-terminal attempt, closes it even at quota, and never starts a fresh repair session', async () => {
	const seen: AnalysisCall[] = [];
	const closed: string[] = [];
	const runner = { run: async (_prompt: string, call: AnalysisCall) => { seen.push(call); return { status: 'succeeded' as const, terminalId: 'retained', text: seen.length === 1 ? 'invalid' : analysisAnswer() }; }, close: async (id: string) => { closed.push(id); } };
	expect(await runMaterialAnalysis(materials.slice(0, 1), [], runner, 2)).toMatchObject({ status: 'complete', calls: 2 });
	expect(seen[1]?.continueTerminalId).toBe('retained');
	expect(closed).toEqual(['retained']);
	seen.length = 0;
	expect(await runMaterialAnalysis(materials.slice(0, 1), [], runner, 1)).toMatchObject({ status: 'budget', calls: 1 });
	expect(closed).toHaveLength(2);
	let badCalls = 0;
	expect(await runMaterialAnalysis(materials.slice(0, 1), [], { run: async () => { badCalls++; return { status: 'succeeded', terminalId: 'bad', text: 'invalid' }; } }, 20)).toMatchObject({ status: 'failed', calls: 2 });
	expect(badCalls).toBe(2);
});

test('double scoring starts fresh independent calls and counts the second sample', async () => {
	const seen: { prompt: string; call: AnalysisCall }[] = [];
	const result = await runMaterialAnalysis(materials.slice(0, 1), [], { run: async (prompt, call) => { seen.push({ prompt, call }); return { status: 'succeeded', text: analysisAnswer() }; } }, 20, 0, Date.now(), { doubleScore: true });
	expect(seen).toHaveLength(2);
	expect(seen[0]?.prompt).toBe(seen[1]?.prompt);
	expect(seen.map(item => [item.call.sample, item.call.attempt, item.call.continueTerminalId])).toEqual([[0, 0, undefined], [1, 0, undefined]]);
	expect(result.analyses[0]?.samples).toHaveLength(2);
	expect(result.calls).toBe(2);
});
