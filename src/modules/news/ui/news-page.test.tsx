import { analysisAnswer, analysisRow, factAnswer, promptMaterialIds } from '../../../../test/news/analysis';
import { memoryNotes } from '../../../../test/news/notes';
import { DOMParser } from 'linkedom';
import { vi } from 'vitest';
import assert from 'node:assert/strict';
import { h, render } from 'preact';
import { Setting } from '../../../../scripts/obsidian-stub';
import { test } from 'vitest';
import { El } from '../../../../scripts/mini-dom';
import { flush, installDom, key } from '../../../../test/dom';
import { registerMessages } from '../../../shared/i18n';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { TextStorage } from '../../../shared/storage/ports';
import { getLanguage, t } from '../../../shared/i18n';
import { HeatChart } from './HeatChart';
import { observeHeatHour, type HeatFact } from '../core/heat';
import type { NewsHeatSnapshot } from '../core/model';
import { messages } from '../i18n';
import type { NewsSettings } from '../settings';
import { newsActions } from '../services/news-actions';
import { NewsService } from '../services/news-service';
import type { NewsMaterial } from '../core/model';
import { briefPath } from '../platform/notes';
import { EventDetail } from './EventDetail';
import { NewsPage } from './NewsPage';
import { newsPageState, type NewsSection } from './page-state';
import { newsSettingsPage } from './settings-page';

registerMessages(messages);
const { document } = installDom();

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

function settingsOf(initial: NewsSettings): SettingsHandle<NewsSettings> {
	let current = initial;
	return {
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

async function settle(): Promise<void> {
	for (let i = 0; i < 8; i++) await flush();
}
function mountPage(service: NewsService, actions: ReturnType<typeof newsActions>, root: HTMLElement) {
	let state = newsPageState({ section: 'all' });
	const paint = () => render(h(NewsPage, { service, actions, state, onState: patch => { state = newsPageState({ ...state, ...patch }); paint(); } }), root);
	return { paint, section: (section: NewsSection) => { state = { ...state, section }; paint(); } };
}

test('the news page and settings turn collection on, import, favorite, analyze, and build the edition', async () => {
	const store = memory();
	const settings = settingsOf({ enabled: false, sources: [], views: [], interest: '', analysisEnabled: true, writeDailyNote: false, autoRefresh: false });
	const service = new NewsService(store, memoryNotes(store), () => settings.get(), {
		fetch: async () => ({ status: 200, text: '<rss><channel><item><title>Hello</title><link>https://example.com/hello</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>' }),
	});
	const actions = newsActions(service, settings, () => ({
		run: async (request) => {
			return { status: 'succeeded' as const, text: factAnswer(request.prompt) };
		},
	}));
	await service.ready;
	const root = document.createElement('div');
	document.body.append(root);
	const page = mountPage(service, actions, root), paint = page.paint;
	paint();
	await flush();
	const button = (label: string) => [...root.querySelectorAll('button')].find((item) => item.textContent === label);
	await actions.importOpml('<opml><body><outline text="Example" xmlUrl="https://example.com/feed.xml"/></body></opml>');
	await settle();
	assert.equal(settings.get().enabled, true);
	assert.equal(settings.get().sources.length, 1);
	button(t('news.refresh'))?.click();
	await settle();
	paint();
	await flush();
	assert.equal(root.querySelectorAll('li').length, 1);
	button('Hello')?.click(); await flush();
	const note = root.querySelector('.nand-news-detail textarea') as HTMLTextAreaElement;
	note.value = 'keep this';
	note.dispatchEvent(new Event('input', { bubbles: true }));
	await flush();
	button(t('news.favorite'))?.click();
	await settle();
	assert.match([...store.files.values()].join('\n'), /keep this/);
	button(t('news.analyze'))?.click();
	await settle();
	paint();
	await flush();
	assert.ok(root.textContent?.includes(t('news.run.complete')));
	const environment = globalThis as { document?: unknown; activeDocument?: unknown };
	const savedDocument = environment.document;
	const savedActive = environment.activeDocument;
	environment.document = undefined;
	environment.activeDocument = undefined;
	try {
		const before = Setting.created.length;
		newsSettingsPage(settings, actions, async () => null)(new El('div') as unknown as HTMLElement, { keep: () => {}, refresh: () => {} });
		const daily = Setting.created.slice(before).find((item) => item.name === t('news.settings.daily'));
		await daily?.toggles[0]?.fire?.(true);
	} finally {
		environment.document = savedDocument;
		environment.activeDocument = savedActive;
	}
	page.section('today'); await flush();
	assert.match(root.textContent ?? '', /edition|要闻|\d{4}-\d{2}-\d{2}/);
	await service.shutdown();
	render(null, root);
});

test('an original without the built-in browser opens in the system window', async () => {
	const store = memory();
	const settings = settingsOf({ enabled: true, sources: [], views: [], interest: '', analysisEnabled: false, writeDailyNote: false, autoRefresh: false });
	const service = new NewsService(store, memoryNotes(store), () => settings.get(), {
		fetch: async () => ({ status: 200, text: '<rss><channel><item><title>标题</title><link>https://example.com/hello</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate><description>摘要</description></item></channel></rss>' }),
	});
	const actions = newsActions(service, settings, () => undefined);
	const system: string[] = [];
	const originalOpen = window.open;
	window.open = ((url?: string | URL) => {
		system.push(String(url));
		return null;
	}) as typeof window.open;
	await service.ready;
	await actions.addSource('https://example.com/feed.xml');
	await service.refresh();
	const root = document.createElement('div');
	document.body.append(root);
	try {
		mountPage(service, actions, root).paint();
		await flush();
		[...root.querySelectorAll('button')].find((item) => item.textContent === '标题')?.click();
		await flush();
		[...root.querySelectorAll('button')].find((item) => item.textContent === t('news.openOriginal'))?.click();
		await settle();
		assert.deepEqual(system, ['https://example.com/hello']);
	} finally {
		window.open = originalOpen;
		await service.shutdown();
		render(null, root);
	}
});

test('reader actions open the original, paste into an agent, write one brief, and hide the row', async () => {
	const store = memory();
	const settings = settingsOf({ enabled: false, sources: [], views: [], interest: '', analysisEnabled: true, writeDailyNote: false, autoRefresh: false });
	const service = new NewsService(store, memoryNotes(store), () => settings.get(), {
		fetch: async () => ({ status: 200, text: '<rss><channel><item><title>标题</title><link>https://example.com/hello</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate><description>摘要</description></item></channel></rss>' }),
	});
	const opened: string[] = [];
	const pasted: string[] = [];
	const notified: string[] = [];
	const system: string[] = [];
	const originalOpen = window.open;
	window.open = ((url?: string | URL) => {
		system.push(String(url));
		return null;
	}) as typeof window.open;
	const actions = newsActions(service, settings, () => ({
		run: async (request) => {
			if (request.purpose === 'news-brief') {
				const payload = JSON.parse(request.prompt.slice(request.prompt.lastIndexOf('\n\n') + 2)) as { sources: { url: string }[] };
				const url = payload.sources[0]?.url ?? '';
				return { status: 'succeeded' as const, text: `## 背景\n[来源](<${url}>)\n## 影响\n实际影响\n## 时间线\n今天发布` };
			}
			return { status: 'succeeded' as const, text: factAnswer(request.prompt) };
		},
	}), {
		browser: () => ({ open: async (request) => { opened.push(request.url ?? ''); return 'page'; }, show: async () => undefined }),
		sessions: () => ({ list: async () => [{ id: 's1', title: 'Claude' }], attachMaterial: async (_id, material) => { pasted.push(material.text); } }),
		inbox: () => ({
			records: [],
			unread: 0,
			available: () => true,
			send: async (request) => {
				assert.equal(request.target, undefined);
				if (!notified.includes(request.id)) notified.push(request.id);
			},
			subscribe: () => () => undefined,
		}),
	});
	await service.ready;
	const root = document.createElement('div');
	document.body.append(root);
	const paint = mountPage(service, actions, root).paint;
	try {
		await actions.addSource('https://example.com/feed.xml');
		await service.refresh();
		paint();
		await flush();
		const click = (label: string) => [...root.querySelectorAll('button')].find((item) => item.textContent === label)?.click();
		click('标题');
		await flush();
		assert.match(root.textContent ?? '', /摘要/);
		assert.match(root.textContent ?? '', /https:\/\/example.com\/hello/);
		click(t('news.openOriginal'));
		await settle();
		assert.deepEqual(opened, ['https://example.com/hello']);
		assert.deepEqual(system, []);
		click(`${t('news.attach')} Claude`);
		await settle();
		assert.equal(pasted.length, 1);
		assert.match(pasted[0] ?? '', /https:\/\/example.com\/hello/);
		click(t('news.analyze'));
		await settle();
		assert.match(root.textContent ?? '', /来源清楚/);
		click(t('news.brief'));
		await settle();
		paint();
		await flush();
		const story = service.stories()[0];
		assert.match(store.files.get(story ? briefPath(story.id) : '') ?? '', /背景/);
		assert.match(root.textContent ?? '', new RegExp(t('news.briefSaved')));
		assert.equal(notified.length, 0); // Default policy reports failures only.
		click(t('news.hide'));
		await settle();
		paint();
		await flush();
		assert.equal(root.querySelectorAll('main > ul > li').length, 0);
		const early = { id: 'a', sourceId: 'alpha', sourceItemId: 'a', originalUrl: 'https://example.com/a', canonicalKey: 'a', title: '早', bodyExcerpt: '早', discoveredAt: 1, publishedAt: 1, revision: 1, contentHash: 'a', summary: '早' } as NewsMaterial;
		const late = { ...early, id: 'b', sourceItemId: 'b', originalUrl: 'https://example.com/b', canonicalKey: 'b', title: '晚', bodyExcerpt: '晚', discoveredAt: 2, publishedAt: 2, contentHash: 'b', summary: '晚' };
		const orderRoot = document.createElement('div');
		document.body.append(orderRoot);
		let order: 'asc' | 'desc' = 'desc';
		const showOrder = () => render(h(EventDetail, {
			occurrences: [], sources: service.sources(),
			reports: [early, late],
			order,
			sessions: [],
			onOrder: () => { order = order === 'asc' ? 'desc' : 'asc'; showOrder(); },
			onOpen: () => undefined,
			onAttach: () => undefined,
			onHide: () => undefined,
			onRead: () => undefined,
		}), orderRoot);
		showOrder();
		const titles = () => [...orderRoot.querySelectorAll('strong')].map((item) => item.textContent).join(',');
		assert.equal(titles(), '晚,早');
		orderRoot.querySelector('button')?.click();
		await flush();
		assert.equal(titles(), '早,晚');
		render(null, orderRoot);
	} finally {
		window.open = originalOpen;
		await service.shutdown();
		render(null, root);
	}
});

const stamp = (hour: number) => new Date(hour).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

test('the heat chart selects visible observations by keyboard, shows local time and leaves real gaps', async () => {
	const now = Math.floor(Date.now() / 3_600_000) * 3_600_000, hour = 3_600_000;
	const facts: HeatFact[] = [40, 30, 3, 2].map(hours => ({ eventId: 'e', participantId: 'a', sourceId: 'source', editorial: true, at: now - hours * hour, addedAt: 0, stale: false }));
	const points = [40, 30, 3, 2].reduce((rows, hours) => observeHeatHour(facts, now - hours * hour, rows), [] as NewsHeatSnapshot[]);
	const root = document.createElement('div'); document.body.append(root);
	render(h(HeatChart, { points, facts, now, eventId: 'e' }), root); await flush();
	const hours = () => [...root.querySelectorAll('[data-hour]')].map(item => Number(item.getAttribute('data-hour')));
	assert.deepEqual(hours(), [40, 30, 3, 2].map(ago => now - ago * hour));
	assert.equal(root.querySelectorAll('polyline').length, 1);
	assert.equal(root.querySelectorAll('circle').length, 4);
	assert.ok(root.textContent?.includes(stamp(now - 40 * hour)));
	const chart = root.querySelector('.nand-news-heat-chart')!, live = root.querySelector('[aria-live]')!;
	key(chart, 'ArrowRight'); await flush();
	assert.equal(live.textContent, t('news.heatPoint', { heat: 10, time: stamp(now - 40 * hour) }));
	assert.equal(live.classList.contains('nand-visually-hidden'), false);
	key(chart, 'ArrowRight'); await flush();
	assert.equal(live.textContent, t('news.heatPoint', { heat: 10, time: stamp(now - 30 * hour) }));
	key(chart, 'ArrowLeft'); await flush();
	assert.equal(live.textContent, t('news.heatPoint', { heat: 10, time: stamp(now - 40 * hour) }));
	key(chart, 'Escape'); await flush(); assert.equal(live.textContent, '');
	[...root.querySelectorAll('button')].find(item => item.textContent === t('news.heat24'))!.click(); await flush();
	assert.deepEqual(hours(), [now - 3 * hour, now - 2 * hour]);
	assert.equal(root.querySelectorAll('svg').length, 0);
	assert.ok(root.textContent?.includes(t('news.heatInsufficient')));
	render(null, root);
});

test('a source added during the plot cannot create a historical jump', async () => {
	const now = Math.floor(Date.now() / 3_600_000) * 3_600_000, hour = 3_600_000;
	const facts: HeatFact[] = [50, 40, 30, 2].map(hours => ({ eventId: 'e', participantId: 'a', sourceId: 'old', editorial: true, at: now - hours * hour, addedAt: 0, stale: false }));
	facts.push({ eventId: 'e', participantId: 'late', sourceId: 'late', editorial: true, at: now - 2 * hour, addedAt: now - 10 * hour, stale: false });
	const points = [50, 40, 30, 2].reduce((rows, hours) => observeHeatHour(facts, now - hours * hour, rows), [] as NewsHeatSnapshot[]);
	const root = document.createElement('div'); document.body.append(root);
	render(h(HeatChart, { points, facts, now, eventId: 'e' }), root); await flush();
	assert.deepEqual([...root.querySelectorAll('[data-hour]')].map(item => item.textContent), ['10', '10', '10', '10']);
	assert.equal(root.querySelectorAll('polyline').length, 0);
	assert.equal(root.querySelectorAll('circle').length, 4);
	render(null, root);
});

vi.stubGlobal('DOMParser', DOMParser);
