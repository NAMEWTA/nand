import assert from 'node:assert/strict';
import { h, render } from 'preact';
import { Setting } from '../../../../scripts/obsidian-stub';
import { test } from 'vitest';
import { El } from '../../../../scripts/mini-dom';
import { flush, installDom, key } from '../../../../test/dom';
import { registerMessages } from '../../../shared/i18n';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { TextStorage } from '../../../shared/storage/ports';
import { t } from '../../../shared/i18n';
import { messages } from '../i18n';
import type { NewsSettings } from '../settings';
import { newsActions } from '../services/news-actions';
import { NewsService } from '../services/news-service';
import type { NewsMaterial } from '../core/model';
import { briefPath } from '../platform/notes';
import { EventDetail } from './EventDetail';
import { NewsPage } from './NewsPage';
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

test('the news page and settings turn collection on, import, favorite, analyze, and build the edition', async () => {
	const store = memory();
	const settings = settingsOf({ enabled: false, sources: [], views: [], interest: '', analysisEnabled: true, dailyEditionEnabled: false, autoRefresh: false });
	const service = new NewsService(store, () => settings.get(), {
		fetch: async () => ({ status: 200, text: '<rss><channel><item><title>Hello</title><link>https://example.com/hello</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>' }),
	});
	const actions = newsActions(service, settings, () => ({
		run: async (request) => {
			const id = request.prompt.match(/id=(\S+)/)?.[1] ?? '';
			return { status: 'complete' as const, text: JSON.stringify([{ id, axes: { relevance: 80, novelty: 70, quality: 60, impact: 50, clarity: 90 }, target: 'featured' }]) };
		},
	}));
	await service.ready;
	const root = document.createElement('div');
	document.body.append(root);
	const paint = () => render(h(NewsPage, { service, actions }), root);
	paint();
	await flush();
	const button = (label: string) => [...root.querySelectorAll('button')].find((item) => item.textContent === label);
	const opml = root.querySelector('textarea') as HTMLTextAreaElement;
	opml.value = '<opml><body><outline text="Example" xmlUrl="https://example.com/feed.xml"/></body></opml>';
	opml.dispatchEvent(new Event('input', { bubbles: true }));
	await flush();
	button(t('news.importOpml'))?.click();
	await settle();
	assert.equal(settings.get().enabled, true);
	assert.equal(settings.get().sources.length, 1);
	button(t('news.refresh'))?.click();
	await settle();
	paint();
	await flush();
	assert.equal(root.querySelectorAll('li').length, 1);
	const note = root.querySelector('li input') as HTMLInputElement;
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
	assert.match(root.textContent ?? '', /complete/);
	const environment = globalThis as { document?: unknown; activeDocument?: unknown };
	const savedDocument = environment.document;
	const savedActive = environment.activeDocument;
	environment.document = undefined;
	environment.activeDocument = undefined;
	try {
		const before = Setting.created.length;
		newsSettingsPage(settings, actions)(new El('div') as unknown as HTMLElement);
		const daily = Setting.created.slice(before).find((item) => item.name === t('news.settings.daily'));
		await daily?.toggles[0]?.fire?.(true);
	} finally {
		environment.document = savedDocument;
		environment.activeDocument = savedActive;
	}
	paint();
	await flush();
	assert.match(root.textContent ?? '', /edition|精选|\d{4}-\d{2}-\d{2}/);
	await service.shutdown();
	render(null, root);
});

test('an original without the built-in browser opens in the system window', async () => {
	const store = memory();
	const settings = settingsOf({ enabled: true, sources: [], views: [], interest: '', analysisEnabled: false, dailyEditionEnabled: false, autoRefresh: false });
	const service = new NewsService(store, () => settings.get(), {
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
		render(h(NewsPage, { service, actions }), root);
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
	const settings = settingsOf({ enabled: false, sources: [], views: [], interest: '', analysisEnabled: true, dailyEditionEnabled: false, autoRefresh: false });
	const service = new NewsService(store, () => settings.get(), {
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
				const url = request.prompt.match(/url=(\S+)/)?.[1] ?? '';
				return { status: 'complete' as const, text: `背景\n${url}\n影响\n时间线` };
			}
			const id = request.prompt.match(/id=(\S+)/)?.[1] ?? '';
			return { status: 'complete' as const, text: JSON.stringify([{ id, axes: { relevance: 80, novelty: 70, quality: 60, impact: 50, clarity: 90 }, target: 'featured', reason: '来源清楚' }]) };
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
	const paint = () => render(h(NewsPage, { service, actions }), root);
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
		assert.equal(notified.length, 1);
		assert.match(notified[0] ?? '', /^news:[^:]+:complete$/);
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

const stamp = (hour: number) => new Date(hour).toISOString().slice(0, 16).replace('T', ' ');

test('the heat chart moves by keyboard and does not draw a gap or a short series', async () => {
	const store = memory();
	const now = Date.now();
	const hour = 3_600_000;
	const current = Math.floor(now / hour) * hour;
	const row = (hoursAgo: number, heat: number, cohort = 'a,b', complete = true) => ({
		sourceId: 'e1',
		eventId: 'e1',
		score: heat,
		observedAt: current - hoursAgo * hour + hour,
		hour: current - hoursAgo * hour,
		complete,
		cohort,
		cohortSize: 2,
		participants: 2,
		ruleVersion: 'heat-v1',
	});
	store.files.set('.nand/news/local/heat.json', JSON.stringify({
		version: 1,
		items: [row(2, 10), row(3, 11), row(30, 12), row(40, 13), row(0, 7, 'a,b', false)],
	}));
	const settings = settingsOf({ enabled: true, sources: [], views: [], interest: '', analysisEnabled: false, dailyEditionEnabled: false, autoRefresh: false });
	const service = new NewsService(store, () => settings.get());
	const actions = newsActions(service, settings, () => undefined);
	await service.ready;
	const root = document.createElement('div');
	document.body.append(root);
	render(h(NewsPage, { service, actions }), root);
	await flush();
	const hours = () => [...root.querySelectorAll('[data-hour]')].map((item) => Number(item.getAttribute('data-hour')));
	assert.deepEqual(hours(), [current - 40 * hour, current - 30 * hour, current - 3 * hour, current - 2 * hour]);
	assert.equal(root.querySelectorAll('polyline').length, 1);
	assert.equal(root.textContent?.includes(stamp(current - 40 * hour)), true);
	assert.equal(root.textContent?.includes(stamp(current - 2 * hour)), true);
	assert.equal(root.textContent?.includes(stamp(current - 4 * hour)), false);
	assert.equal(root.textContent?.includes(stamp(current)), false);
	const chart = root.querySelector('.nand-news-heat-chart');
	const live = root.querySelector('[aria-live]');
	assert.ok(chart);
	key(chart, 'ArrowRight');
	await flush();
	assert.equal(live?.textContent, t('news.heatPoint', { heat: 13, time: stamp(current - 40 * hour) }));
	key(chart, 'ArrowRight');
	await flush();
	assert.equal(live?.textContent, t('news.heatPoint', { heat: 12, time: stamp(current - 30 * hour) }));
	key(chart, 'ArrowLeft');
	await flush();
	assert.equal(live?.textContent, t('news.heatPoint', { heat: 13, time: stamp(current - 40 * hour) }));
	key(chart, 'Escape');
	await flush();
	assert.equal(live?.textContent, '');
	[...root.querySelectorAll('button')].find((item) => item.textContent === t('news.heat24'))?.click();
	await flush();
	assert.deepEqual(hours(), [current - 3 * hour, current - 2 * hour]);
	assert.equal(root.querySelectorAll('polyline').length, 0);
	assert.equal(root.textContent?.includes(stamp(current - 40 * hour)), false);
	await service.shutdown();
	render(null, root);
});

test('a heat chart with a new cohort does not connect older hours or draw under three points', async () => {
	const store = memory();
	const now = Date.now();
	const hour = 3_600_000;
	const current = Math.floor(now / hour) * hour;
	const row = (hoursAgo: number, heat: number, cohort: string) => ({
		sourceId: 'e1', eventId: 'e1', score: heat, observedAt: current - hoursAgo * hour + hour, hour: current - hoursAgo * hour, complete: true, cohort, cohortSize: 2, participants: 2, ruleVersion: 'heat-v1',
	});
	store.files.set('.nand/news/local/heat.json', JSON.stringify({ version: 1, items: [row(50, 21, 'old'), row(40, 22, 'old'), row(30, 23, 'old'), row(2, 9, 'new')] }));
	const settings = settingsOf({ enabled: true, sources: [], views: [], interest: '', analysisEnabled: false, dailyEditionEnabled: false, autoRefresh: false });
	const service = new NewsService(store, () => settings.get());
	await service.ready;
	const root = document.createElement('div');
	document.body.append(root);
	render(h(NewsPage, { service, actions: newsActions(service, settings, () => undefined) }), root);
	await flush();
	assert.deepEqual([...root.querySelectorAll('[data-hour]')].map((item) => item.textContent), ['9']);
	assert.equal(root.querySelectorAll('polyline').length, 0);
	assert.equal(root.textContent?.includes(stamp(current - 50 * hour)), false);
	await service.shutdown();
	render(null, root);
});
