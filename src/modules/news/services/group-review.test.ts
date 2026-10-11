import { expect, test } from 'vitest';
import { emptyEvents } from '../core/grouping';
import { upsertMaterial } from '../core/materials';
import type { NewsRun } from '../core/model';
import type { AnalysisCall } from '../core/analysis-run';
import { recoverGroupReviews, reviewGroups, type GroupReviewPort } from './group-review';
import { NewsRunJournal } from './run-journal';

const answer = '<nand-news-merge>{"kind":"SAME_STORY","confidence":0.75}</nand-news-merge>';
async function fixture() {
	let runs: NewsRun[] = [], failApply = false, failSave = false;
	const events = emptyEvents();
	const left = await upsertMaterial(undefined, { sourceId: 'secret-left', url: 'https://example.com/a', title: 'Launch', body: 'Company released product.' });
	const right = await upsertMaterial(undefined, { sourceId: 'secret-right', url: 'https://example.com/b', title: 'Review', body: 'Person tested product.' });
	events.proposals.push({ id: 'proposal', leftId: 'left', rightId: 'right', left, right, bridgeId: 'bridge' });
	const port: GroupReviewPort = { events: () => events, runs: () => runs, stopped: () => false, apply: async review => { if (failApply) throw new Error('disk'); events.reviews.push(review); } };
	const journal = new NewsRunJournal(() => runs, async next => { if (failSave) throw new Error('disk'); runs = structuredClone(next); });
	return { events, port, journal, runs: () => runs, failApply: (value: boolean) => { failApply = value; }, failSave: (value: boolean) => { failSave = value; } };
}

test('root review starts independently, repairs in its retained terminal and shares the daily quota', async () => {
	const f = await fixture(), calls: AnalysisCall[] = [], closed: string[] = [];
	const runner = { run: async (prompt: string, call: AnalysisCall) => {
		calls.push(call);
		expect(f.runs().at(-1)?.receipt?.state).toBe('started');
		expect(prompt).not.toContain('secret-left');
		return { status: 'succeeded' as const, text: calls.length === 1 ? 'bad' : answer, terminalId: 'review-owned' };
	}, close: async (id: string) => { closed.push(id); } };
	expect(await reviewGroups(f.port, f.journal, runner, {}, 2, new Set())).toEqual({ status: 'complete', calls: 2 });
	expect(calls[0]?.continueTerminalId).toBeUndefined();
	expect(calls[1]?.continueTerminalId).toBe('review-owned');
	expect(closed).toEqual(['review-owned']);
	expect(f.events.reviews[0]?.confidence).toBe(0.75);
	expect(f.journal.spent()).toBe(2);
	expect(await reviewGroups(f.port, f.journal, runner, {}, 2, new Set())).toEqual({ status: 'complete', calls: 0 });
});

test('a received review recovers locally after its event write failed, without another call', async () => {
	const f = await fixture(); f.failApply(true);
	let closed = false;
	await expect(reviewGroups(f.port, f.journal, { run: async () => ({ status: 'succeeded', text: answer, terminalId: 'owned' }), close: async () => { closed = true; } }, {}, 20, new Set())).rejects.toThrow('disk');
	expect(closed).toBe(true);
	expect(f.runs()[0]?.receipt?.state).toBe('received');
	f.failApply(false);
	await recoverGroupReviews(f.port, f.journal);
	expect(f.events.reviews).toHaveLength(1);
	expect(f.runs()[0]?.receipt?.state).toBe('applied');
	expect(f.journal.spent()).toBe(1);
});

test('unknown merge outcomes wait for explicit retry; low-confidence reviews do not loop automatically', async () => {
	const f = await fixture();
	expect(await reviewGroups(f.port, f.journal, { run: async () => ({ status: 'interrupted', text: '' }) }, {}, 20, new Set())).toMatchObject({ status: 'interrupted', calls: 1 });
	let calls = 0;
	const runner = { run: async () => { calls++; return { status: 'succeeded' as const, text: answer.replace('0.75', '0.74') }; } };
	expect(await reviewGroups(f.port, f.journal, runner, {}, 20, new Set())).toMatchObject({ status: 'needs-attention', calls: 0 });
	expect(await reviewGroups(f.port, f.journal, runner, {}, 20, new Set(['bridge']))).toMatchObject({ status: 'needs-attention', calls: 1 });
	expect(await reviewGroups(f.port, f.journal, runner, {}, 20, new Set())).toMatchObject({ status: 'needs-attention', calls: 0 });
	expect(calls).toBe(1);
});

test('a raw review receipt write failure still closes the owned process and does not merge', async () => {
	const f = await fixture(); let closed = false;
	await expect(reviewGroups(f.port, f.journal, { run: async () => { f.failSave(true); return { status: 'succeeded', text: answer, terminalId: 'owned' }; }, close: async () => { closed = true; } }, {}, 20, new Set())).rejects.toThrow('disk');
	expect(closed).toBe(true);
	expect(f.events.reviews).toEqual([]);
	expect(f.runs()[0]?.receipt?.state).toBe('started');
});
