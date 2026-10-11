import { expect, test, vi } from 'vitest';
import { analysisAnswer, analysisRow } from '../../../../test/news/analysis';
import { memoryNotes } from '../../../../test/news/notes';
import type { TextStorage } from '../../../shared/storage/ports';
import type { NewsRun, NewsSource } from '../core/model';
import { upsertMaterial } from '../core/materials';
import type { NewsSettings } from '../settings';
import { NewsService } from './news-service';
import { NewsRunJournal, newsLocalDay } from './run-journal';

async function fixture(count = 1, extra: Partial<NewsSettings> = {}) {
	const files = new Map<string, string>();
	let failPath = '';
	const storage: TextStorage & { files: Map<string, string> } = {
		files, exists: async path => files.has(path), read: async path => { if (!files.has(path)) throw new Error('missing'); return files.get(path)!; },
		write: async (path, body) => { if (path === failPath) throw new Error('disk'); files.set(path, body); }, mkdir: async () => undefined,
	};
	const materials = await Promise.all(Array.from({ length: count }, (_, i) => upsertMaterial(undefined, { sourceId: 'test', url: `https://example.com/${i}`, title: 'News', summary: 'Facts' })));
	files.set('.nand/news/local/materials.json', JSON.stringify({ version: 1, items: materials }));
	const source: NewsSource = { id: 'test', name: 'Test', type: 'rss', url: 'https://example.com/rss', tier: 'T1', participation: 'editorial', intervalMinutes: 60, enabled: true };
	const settings = { enabled: true, analysisEnabled: true, sources: [source], views: [], ...extra };
	const create = () => new NewsService(storage, memoryNotes(storage), () => settings);
	return { storage, materials, settings, create, fail: (path = '') => { failPath = path; }, runs: (): NewsRun[] => JSON.parse(files.get('.nand/news/local/runs.json') ?? '{"items":[]}').items };
}

test('pre-send write failure prevents the CLI; raw response failure never applies business results', async () => {
	const f = await fixture();
	const service = f.create(); await service.ready;
	f.fail('.nand/news/local/runs.json');
	let calls = 0;
	await expect(service.analyze({ run: async () => { calls++; return { status: 'succeeded', text: analysisAnswer() }; } })).rejects.toThrow('disk');
	expect(calls).toBe(0);
	f.fail();
	await expect(service.analyze({ run: async () => { calls++; expect(f.runs()[0]?.receipt?.state).toBe('started'); f.fail('.nand/news/local/runs.json'); return { status: 'succeeded', text: analysisAnswer() }; } })).rejects.toThrow('disk');
	// A failed raw write leaves the started reservation, never an applied analysis.
	expect(service.analyses()).toHaveLength(0);
	expect(f.runs()[0]?.receipt?.state).toBe('started');
	f.fail(); await expect(service.shutdown()).rejects.toThrow('disk');
});

test('received answers survive a failed business write and restart applies them with zero sends', async () => {
	const f = await fixture(); const service = f.create(); await service.ready;
	f.fail('.nand/news/local/analyses.json');
	await expect(service.analyze({ run: async () => ({ status: 'succeeded', text: analysisAnswer() }) })).rejects.toThrow('disk');
	expect(f.runs()[0]?.receipt).toMatchObject({ state: 'received', usageKnown: false, result: { text: analysisAnswer() } });
	f.fail();
	// Simulate the restarted process using only persisted records.
	const restarted = f.create(); await restarted.ready;
	expect(restarted.analyses()).toHaveLength(1);
	expect(f.runs()[0]?.receipt?.state).toBe('applied');
	expect(await restarted.analyze({ run: async () => { throw new Error('must not send'); } })).toMatchObject({ calls: 0, spent: 1 });
	await restarted.shutdown();
});

test('unknown started results become interrupted and require explicit material retry', async () => {
	const f = await fixture(); const service = f.create(); await service.ready;
	await service.analyze({ run: async () => ({ status: 'interrupted', text: '', terminalId: 'lost' }) });
	const runs = f.runs(); runs[0]!.receipt!.state = 'started'; runs[0]!.status = 'started'; delete runs[0]!.receipt!.result;
	f.storage.files.set('.nand/news/local/runs.json', JSON.stringify({ version: 1, items: runs }));
	const restarted = f.create(); await restarted.ready;
	expect(f.runs()[0]?.receipt?.state).toBe('interrupted');
	let calls = 0; const runner = { run: async () => { calls++; return { status: 'succeeded' as const, text: analysisAnswer() }; } };
	expect(await restarted.analyze(runner)).toMatchObject({ status: 'needs-attention', calls: 0 });
	expect(calls).toBe(0);
	expect(await restarted.analyze(runner, 20, new Set(f.materials.map(item => item.id)))).toMatchObject({ status: 'complete', calls: 1, spent: 2 });
	await restarted.shutdown();
});

test('double scoring resumes only its missing second call and retains the original prompt version', async () => {
	const f = await fixture(1, { doubleScore: true }); const service = f.create(); await service.ready;
	const first = await service.analyze({ run: async () => ({ status: 'succeeded', text: analysisAnswer() }) }, 1);
	expect(first).toMatchObject({ status: 'budget', calls: 1 });
	expect(service.analyses()).toHaveLength(0);
	const savedVersion = f.runs()[0]!.receipt!.plan!.version;
	f.settings.interest = 'Changed after first sample';
	const restarted = f.create(); await restarted.ready;
	let sample = -1;
	expect(await restarted.analyze({ run: async (_prompt, call) => { sample = call.sample; return { status: 'succeeded', text: analysisAnswer() }; } }, 2)).toMatchObject({ status: 'complete', calls: 1 });
	expect(sample).toBe(1);
	expect(restarted.analyses()[0]).toMatchObject({ version: savedVersion, samples: [{ axes: analysisRow().axes }, { axes: analysisRow().axes }] });
	await restarted.shutdown();
});

test('daily quota survives restart and cache clearing, resets by local day and refunds preflight rejection', async () => {
	vi.useFakeTimers({ now: new Date(2026, 9, 10, 23, 59), toFake: ['Date'] });
	try {
		const f = await fixture(2, { batchSize: 1 }); const service = f.create(); await service.ready;
		expect(await service.analyze({ run: async () => ({ status: 'failed', text: '', errorCode: 'cliMissing' }) }, 1)).toMatchObject({ calls: 0, spent: 0 });
		expect(await service.analyze({ run: async () => ({ status: 'succeeded', text: analysisAnswer() }) }, 1)).toMatchObject({ status: 'budget', calls: 1, spent: 1 });
		const restarted = f.create(); await restarted.ready;
		expect(await restarted.analyze({ run: async () => { throw new Error('over quota'); } }, 1)).toMatchObject({ status: 'budget', calls: 0 });
		await restarted.clearCache();
		expect(f.runs().reduce((sum, run) => sum + run.calls, 0)).toBe(1);
		vi.setSystemTime(new Date(2026, 9, 11, 0, 1));
		expect(newsLocalDay()).toBe('2026-10-11');
		// Re-create a material after clearing the cache; yesterday's calls do not spend today's quota.
		f.storage.files.set('.nand/news/local/materials.json', JSON.stringify({ version: 1, items: f.materials }));
		const tomorrow = f.create(); await tomorrow.ready;
		expect(await tomorrow.analyze({ run: async () => ({ status: 'succeeded', text: analysisAnswer() }) }, 1)).toMatchObject({ status: 'budget', calls: 1, spent: 1 });
		await tomorrow.shutdown();
	} finally { vi.useRealTimers(); }
});

test('analysis and brief calls share one serialized quota reservation', async () => {
	let records: NewsRun[] = [];
	let release!: () => void;
	const waiting = new Promise<void>(resolve => { release = resolve; });
	let started!: () => void;
	const entered = new Promise<void>(resolve => { started = resolve; });
	const journal = new NewsRunJournal(() => records, async next => { records = structuredClone(next); });
	const first = journal.call({ kind: 'analysis', batchId: 'a', sample: 0, attempt: 0 }, 1, async () => {
		expect(records[0]?.receipt?.state).toBe('started'); started(); await waiting;
		return { status: 'succeeded', text: analysisAnswer(), usage: { input: 2, output: 3, cacheRead: 0, cacheWrite: 0, cost: null, known: true } };
	});
	await entered;
	let secondCalls = 0;
	const second = journal.call({ kind: 'brief', batchId: 'b', sample: 0, attempt: 0 }, 1, async () => { secondCalls++; return { status: 'succeeded', text: 'Brief' }; });
	expect(records).toHaveLength(1); release();
	await first;
	expect(await second).toMatchObject({ calls: 0, result: { errorCode: 'newsBudget' } });
	expect(secondCalls).toBe(0);
	expect(records[0]?.receipt).toMatchObject({ state: 'received', usageKnown: true, result: { usage: { cost: null } } });
});

test('a new revision is not blocked by an interrupted older revision', async () => {
	const f = await fixture(); const service = f.create(); await service.ready;
	await service.analyze({ run: async () => ({ status: 'interrupted', text: '', terminalId: 'lost' }) });
	f.storage.files.set('.nand/news/local/materials.json', JSON.stringify({ version: 1, items: [{ ...f.materials[0], revision: 2, contentHash: 'new' }] }));
	const restarted = f.create(); await restarted.ready;
	expect(await restarted.analyze({ run: async () => ({ status: 'succeeded', text: analysisAnswer() }) })).toMatchObject({ status: 'complete', calls: 1 });
	expect(restarted.analyses()[0]?.revision).toBe(2);
	await restarted.shutdown();
});

test('explicit reanalysis alone spends quota for a completed revision after interest changes', async () => {
	const f = await fixture(); const service = f.create(); await service.ready;
	const runner = { run: async () => ({ status: 'succeeded' as const, text: analysisAnswer() }) };
	await service.analyze(runner);
	const before = service.analyses()[0]!.version;
	f.settings.interest = 'A new reading preference';
	expect(await service.analyze(runner)).toMatchObject({ calls: 0, spent: 1 });
	expect(await service.analyze(runner, 20, new Set(), new Set([f.materials[0]!.id]))).toMatchObject({ calls: 1, spent: 2 });
	expect(service.analyses()[0]!.version).not.toBe(before);
	await service.shutdown();
});

test('a crash between business persistence and receipt acknowledgement is idempotently acknowledged', async () => {
	const f = await fixture(); const service = f.create(); await service.ready;
	const write = f.storage.write.bind(f.storage);
	f.storage.write = async (path, body) => { await write(path, body); if (path.endsWith('/analyses.json')) f.fail('.nand/news/local/runs.json'); };
	await expect(service.analyze({ run: async () => ({ status: 'succeeded', text: analysisAnswer() }) })).rejects.toThrow('disk');
	expect(f.runs()[0]?.receipt?.state).toBe('received');
	f.storage.write = write; f.fail();
	const restarted = f.create(); await restarted.ready;
	expect(restarted.analyses()).toHaveLength(1);
	expect(f.runs()[0]?.receipt?.state).toBe('applied');
	expect(await restarted.analyze({ run: async () => { throw new Error('duplicate'); } })).toMatchObject({ calls: 0 });
	await restarted.shutdown();
});

test('clearing cache retires partially received batches while retaining their daily charge', async () => {
	const f = await fixture(1, { doubleScore: true }); const service = f.create(); await service.ready;
	await service.analyze({ run: async () => ({ status: 'succeeded', text: analysisAnswer() }) }, 1);
	await service.clearCache();
	expect(f.runs()[0]).toMatchObject({ status: 'superseded', calls: 1, receipt: { state: 'applied' } });
	const restarted = f.create(); await restarted.ready;
	expect(await restarted.analyze({ run: async () => { throw new Error('removed material'); } })).toMatchObject({ calls: 0, spent: 1 });
	await restarted.shutdown();
});
