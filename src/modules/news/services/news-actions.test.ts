import { analysisAnswer, analysisRow, promptMaterialIds } from '../../../../test/news/analysis';
import { memoryNotes } from '../../../../test/news/notes';
import { DOMParser } from 'linkedom';
import { vi } from 'vitest';
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { TextStorage } from '../../../shared/storage/ports';
import type { NewsMaterial } from '../core/model';
import type { NewsSettings } from '../settings';
import type { AgentPromptRequest, AgentPromptRunner } from '../../agent/api';
import { newsActions } from './news-actions';
import { NewsService } from './news-service';

const memory = (): TextStorage & { files: Map<string, string> } => {
	const files = new Map<string, string>();
	return {
		files,
		async exists(path) {
			return files.has(path);
		},
		async read(path) {
			const value = files.get(path);
			if (value === undefined) throw new Error(`missing ${path}`);
			return value;
		},
		async write(path, content) {
			files.set(path, content);
		},
		async mkdir() {},
	};
};

function settingsOf(initial: NewsSettings): SettingsHandle<NewsSettings> & { read(): NewsSettings } {
	let current = initial;
	return {
		read: () => current,
		get: () => current,
		update: async (recipe) => {
			const draft = { ...current, sources: current.sources.slice() };
			recipe(draft);
			current = draft;
		},
		select: () => () => undefined,
		subscribe: () => () => undefined,
		touch: async () => undefined,
	};
}

describe('news page actions', () => {
	test('call timeout and terminal retention cover repair, briefs, default cleanup and consumer disposal', async () => {
		const store = memory();
		const settings = settingsOf({ enabled: true, sources: [], views: [], interest: '', analysisEnabled: true, writeDailyNote: false, autoRefresh: false, keepTerminal: true, batchTimeoutMinutes: 7 });
		const service = new NewsService(store, memoryNotes(store), () => settings.get(), { fetch: async () => ({ status: 200, text: '<rss><channel><item><title>Product</title><link>https://example.com/news</link><description>A company released a product.</description></item></channel></rss>' }) });
		const requests: AgentPromptRequest[] = [], closed: string[] = [], opened: string[] = [];
		let clock = 1000;
		const now = vi.spyOn(performance, 'now').mockImplementation(() => clock);
		let starts = 0;
		const promptRunner: AgentPromptRunner = {
			run: async request => {
				requests.push(request);
				if (requests.length === 1) clock += 60_000;
				const terminalId = request.continueTerminalId ?? `held-${++starts}`;
				const material = service.materials()[0]!;
				const text = request.purpose === 'news-brief' ? `## 背景\n见 [来源](<${material.originalUrl}>)\n## 影响\n继续\n## 时间线\n今天`
					: requests.length === 1 ? 'Invalid JSON' : analysisAnswer([analysisRow('m0', { scope: 'single', subject: 'Company', frame: { title: 'Product', subject: 'Company', action: 'released', object: 'product', occurredAt: null, evidence: 'A company released a product.', conditions: [] } })]);
				return { status: 'succeeded', text, terminalId };
			},
			close: async id => { closed.push(id); }, open: async id => { opened.push(id); },
		};
		let current: AgentPromptRunner | undefined = promptRunner;
		const actions = newsActions(service, settings, () => current, { currentRunner: () => current });
		try {
			await actions.addSource('https://example.com/feed'); await service.refresh();
			const analyzed = await actions.analyze();
			assert.equal(analyzed, 'complete');
			assert.equal(requests.length, 2); assert.equal(starts, 1);
			assert.equal(requests[1]!.continueTerminalId, 'held-1');
			assert.deepEqual(requests.map(r => r.timeoutMs), [7 * 60_000, 6 * 60_000]);
			assert.ok(requests.every(r => r.keepTerminal));
			assert.deepEqual(closed, []); assert.equal(actions.isTerminalRetained('held-1'), true);
			await actions.openAnalysisTerminal('held-1'); assert.deepEqual(opened, ['held-1']);
			await settings.update(d => { d.keepTerminal = false; d.batchTimeoutMinutes = 3; });
			assert.equal(await actions.reanalyze(service.materials()[0]!.id), 'complete');
			assert.equal(requests.at(-1)!.timeoutMs, 3 * 60_000);
			assert.deepEqual(closed, ['held-2']); assert.equal(actions.isTerminalRetained('held-2'), false);
			await settings.update(d => { d.keepTerminal = true; });
			assert.equal((await actions.brief(service.stories()[0]!.id)).status, 'complete');
			assert.equal(requests.at(-1)!.purpose, 'news-brief'); assert.equal(requests.at(-1)!.timeoutMs, 3 * 60_000);
			assert.equal(actions.isTerminalRetained('held-3'), true);
			current = undefined; assert.equal(actions.isTerminalRetained('held-1'), false);
			current = promptRunner;
		} finally { now.mockRestore(); await actions.dispose(); await service.shutdown(); }
		assert.deepEqual(closed.sort(), ['held-1', 'held-2', 'held-3']);
		assert.equal(actions.isTerminalRetained('held-1'), false);
	});
	test('an expired batch closes its repair terminal without another CLI call or quota charge', async () => {
		const store = memory(), settings = settingsOf({ enabled: true, sources: [], views: [], interest: '', analysisEnabled: true, writeDailyNote: false, autoRefresh: false, keepTerminal: true, batchTimeoutMinutes: 1 });
		const service = new NewsService(store, memoryNotes(store), () => settings.get(), { fetch: async () => ({ status: 200, text: '<rss><channel><item><title>News</title><link>https://example.com/news</link><description>A report.</description></item></channel></rss>' }) });
		let clock = 0, calls = 0;
		const now = vi.spyOn(performance, 'now').mockImplementation(() => clock), closed: string[] = [];
		const actions = newsActions(service, settings, () => ({ run: async () => { calls++; clock += 61_000; return { status: 'succeeded', text: 'invalid JSON', terminalId: 'expired' }; }, close: async id => { closed.push(id); } }));
		try {
			await actions.addSource('https://example.com/feed'); await service.refresh();
			assert.equal(await actions.analyze(), 'timeout'); assert.equal(calls, 1); assert.deepEqual(closed, ['expired']);
			assert.equal(service.callBudget().used, 1); assert.equal(actions.isTerminalRetained('expired'), false);
			assert.ok(service.runHistory().some(run => run.status === 'timeout' && run.calls === 0));
		} finally { now.mockRestore(); await actions.dispose(); await service.shutdown(); }
	});
	test('consumer disposal cancels its prompt before service shutdown and prevents later calls', async () => {
		const store = memory();
		const settings = settingsOf({ enabled: true, sources: [], views: [], interest: '', analysisEnabled: true, writeDailyNote: false, autoRefresh: false });
		const service = new NewsService(store, memoryNotes(store), () => settings.get(), { fetch: async () => ({ status: 200, text: '<rss><channel><item><title>News</title><link>https://example.com/news</link><description>Evidence in the report</description></item></channel></rss>' }) });
		let entered!: () => void;
		const started = new Promise<void>(resolve => { entered = resolve; });
		let cancelled = false, calls = 0;
		const actions = newsActions(service, settings, async () => ({ run: request => new Promise(resolve => {
			calls++;
			request.signal!.addEventListener('abort', () => { cancelled = true; resolve({ status: 'cancelled', text: '' }); }, { once: true });
			entered();
		}) }));
		await actions.addSource('https://example.com/feed');
		await service.refresh();
		const analysis = actions.analyze();
		await started;
		await actions.dispose();
		await service.shutdown();
		assert.equal(cancelled, true);
		assert.equal(await analysis, 'cancelled');
		assert.equal(await actions.analyze(), 'failed');
		assert.equal(calls, 1);
	});

	test('enable, refresh, favorite, opml and the daily edition reach the service', async () => {
		const store = memory();
		const settings = settingsOf({ enabled: false, sources: [], views: [], interest: '', analysisEnabled: true, writeDailyNote: false, autoRefresh: false });
		const service = new NewsService(store, memoryNotes(store), () => settings.get(), { fetch: async () => ({ status: 200, text: '<rss><channel><item><title>Hello</title><link>https://example.com/hello</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>' }) });
		const actions = newsActions(service, settings, () => ({
			run: async (request) => {
				const id = promptMaterialIds(request.prompt)[0] ?? '';
				return { status: 'succeeded' as const, text: analysisAnswer([analysisRow(id)]) };
			},
		}));
		await service.ready;
		assert.deepEqual(actions.edition().materialIds, []);
		await actions.enable();
		assert.equal(settings.get().enabled, true);
		const imported = await actions.importOpml('<opml><body><outline text="Example" xmlUrl="https://example.com/feed.xml"/></body></opml>');
		assert.deepEqual(imported, { added: 1, skipped: 0, invalid: 0 });
		assert.equal(await actions.addSource('https://example.com/hello.xml'), true);
		await service.refresh();
		assert.equal(service.materials().length, 1);
		assert.match(store.files.get('.nand/news/local/materials.json') ?? '', /Hello/);
		const material = service.materials()[0] as NewsMaterial;
		await actions.favorite(material, 'keep this');
		const favorite = [...store.files.entries()].find(([path]) => path.includes('/收藏/'));
		assert.match(favorite?.[1] ?? '', /keep this/);
		await settings.update((draft) => {
			draft.writeDailyNote = true;
		});
		const edition = actions.edition();
		const local = new Date();
		assert.equal(edition.date, `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`);
		assert.equal(await actions.analyze(), 'complete');
		await service.shutdown();
	});
});

vi.stubGlobal('DOMParser', DOMParser);
