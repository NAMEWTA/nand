import { analysisAnswer, analysisRow, factAnswer, promptMaterialIds } from '../../../../test/news/analysis';
import { memoryNotes } from '../../../../test/news/notes';
import { DOMParser } from 'linkedom';
import { vi } from 'vitest';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { TextStorage } from '../../../shared/storage/ports';
import type { NotificationInbox, NotificationRecord, NotificationRequest } from '../../notifications/api';
import { newsOpener } from '../contrib/notifications';
import { normalizeNewsSource, type NewsSource } from '../core/model';
import { briefPath, serializeBrief } from '../platform/notes';
import type { NewsSettings } from '../settings';
import { newsActions } from './news-actions';
import { NewsService } from './news-service';
import { defaultNewsWidgets } from '../core/home-widgets';

test('disabling collection while SHA-256 is pending discards the result before persistence', async () => {
	const store = memory(), config = { enabled: true, sources: [source()], views: [] };
	const service = new NewsService(store, memoryNotes(store), () => config, { fetch: async () => ({ status: 200, text: feed }) });
	await service.ready;
	const original = crypto.subtle.digest.bind(crypto.subtle), releases: (() => void)[] = [];
	const spy = vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (algorithm, data) => { await new Promise<void>(resolve => releases.push(resolve)); return original(algorithm, data); });
	try {
		const pending = service.refresh();
		await vi.waitFor(() => assert.equal(releases.length, 2));
		config.enabled = false; service.settingsChanged();
		const before = [...store.files];
		releases.splice(0).forEach(release => release()); await pending;
		assert.deepEqual([...store.files], before); assert.equal(service.materials().length, 0);
	} finally { spy.mockRestore(); releases.splice(0).forEach(release => release()); await service.shutdown(); }
});

test('widget refresh is opt-in, shares pending source work and applies each stale threshold', async () => {
	const store = memory(), config: NewsSettings = { enabled: true, sources: [source()], views: [], widgets: defaultNewsWidgets(), interest: '', analysisEnabled: false, writeDailyNote: false, autoRefresh: false };
	let release!: () => void, calls = 0;
	const service = new NewsService(store, memoryNotes(store), () => config, { fetch: async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); return { status: 200, text: feed }; } });
	const states: number[] = [], off = service.subscribe(() => states.push(service.collectionActivity().pending));
	try {
		await service.refreshWidget('hot'); assert.equal(calls, 0);
		config.refreshWhenStale = true;
		const first = service.refreshWidget('hot');
		await vi.waitFor(() => assert.equal(calls, 1));
		const second = service.refreshWidget('featured'), third = service.refresh();
		assert.equal(service.collectionActivity().pending, 1);
		release(); await Promise.all([first, second, third]);
		assert.equal(calls, 1); assert.equal(service.collectionActivity().pending, 0);
		assert.ok(service.collectionActivity().lastSuccess); assert.ok(states.includes(1)); assert.equal(states.at(-1), 0);
		const now = Date.now(); vi.spyOn(Date, 'now').mockReturnValue(now + 70 * 60_000);
		config.widgets![0]!.staleMinutes = 120; config.widgets![1]!.staleMinutes = 15;
		await service.refreshWidget('featured'); assert.equal(calls, 1);
		const stale = service.refreshWidget('hot'); await vi.waitFor(() => assert.equal(calls, 2)); release(); await stale;
		config.enabled = false; service.settingsChanged(); await service.refreshWidget('hot'); assert.equal(calls, 2);
	} finally { vi.restoreAllMocks(); off(); await service.shutdown(); }
});

const memory = (): TextStorage & { files: Map<string, string>; failBrief: boolean } => {
	const files = new Map<string, string>();
	const store = {
		files,
		failBrief: false,
		async exists(path: string) {
			return files.has(path);
		},
		async read(path: string) {
			const value = files.get(path);
			if (value === undefined) throw new Error(`missing ${path}`);
			return value;
		},
		async write(path: string, content: string) {
			if (store.failBrief && path.startsWith('NAND/')) throw new Error('disk');
			files.set(path, content);
		},
		async mkdir() {},
	};
	return store;
};

const source = (): NewsSource =>
	normalizeNewsSource({
		id: 'alpha',
		name: 'Alpha',
		url: 'https://example.com/feed.xml',
		type: 'rss',
		enabled: true,
		tier: 'T1',
		participation: 'editorial',
		intervalMinutes: 30,
	})!;

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

const feed = '<rss><channel><item><title>标题</title><link>https://example.com/hello</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate><description>摘要</description></item></channel></rss>';

test('configured material retention prunes raw cache but keeps favorite identity and saved Markdown', async () => {
	const store = memory(), now = Date.now();
	const old = { id: 'old', sourceId: 'alpha', sourceItemId: 'old', title: 'Old', originalUrl: 'https://example.com/old', canonicalKey: 'https://example.com/old', bodyExcerpt: 'Old raw body', contentHash: 'old', revision: 1, discoveredAt: now - 2 * 86_400_000 };
	store.files.set('.nand/news/local/materials.json', JSON.stringify({ version: 1, items: [old, { ...old, id: 'discard', sourceItemId: 'discard', canonicalKey: 'https://example.com/discard' }] }));
	const service = new NewsService(store, memoryNotes(store), () => ({ enabled: true, sources: [source()], views: [], retentionDays: 1, adaptiveInterval: false }), { fetch: async () => ({ status: 200, text: feed }) });
	await service.ready; await service.saveFavorite(old, 'Keep this annotation');
	const path = service.favoriteLocation(old.id)!; const saved = store.files.get(path);
	await service.refresh();
	assert.equal(service.materials().some(item => item.id === 'discard'), false);
	assert.equal(service.favorites().some(item => item.id === old.id), true);
	assert.equal(store.files.get(path), saved); assert.match(saved!, /Keep this annotation/);
	assert.equal(service.health('alpha')?.intervalMinutes, 30);
	await service.shutdown();
});

test('a failed material write cannot advance the HTTP cursor or publish uncommitted materials', async () => {
	const store = memory();
	let fail = false;
	const write = store.write.bind(store);
	store.write = async (path, content) => {
		if (fail && path.endsWith('/materials.json')) throw new Error('material disk failure');
		await write(path, content);
	};
	let now = Date.parse('2026-10-09T12:00:00Z');
	const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
	const service = new NewsService(store, memoryNotes(store), () => ({ enabled: true, sources: [source()], views: [] }), {
		fetch: async () => { fail = true; return { status: 200, text: feed, etag: 'new-etag' }; },
	});
	try {
		await assert.rejects(service.refresh(), /material disk failure/);
		const health = JSON.parse(store.files.get('.nand/news/local/reader-state.json')!).items.health.alpha;
		assert.equal(health.etag, undefined);
		assert.equal(health.lastSuccess, undefined);
		assert.equal(health.failureCount, 1);
		assert.equal(service.materials().length, 0);
		fail = false;
		now += 3_600_001;
	} finally {
		clock.mockRestore();
		await assert.rejects(service.shutdown(), /material disk failure/);
	}
});

test('simultaneous refresh requests share sources and a service-wide network limit; a fresh cursor prevents repeated fetches', async () => {
	const store = memory();
	const sources = Array.from({ length: 6 }, (_, i) => ({ ...source(), id: `source-${i}` }));
	let release!: () => void;
	const gate = new Promise<void>(resolve => { release = resolve; });
	let active = 0, maximum = 0, calls = 0;
	const service = new NewsService(store, memoryNotes(store), () => ({ enabled: true, sources, views: [] }), { fetch: async () => {
		calls++; active++; maximum = Math.max(maximum, active);
		await gate; active--;
		return { status: 200, text: '<rss><channel/></rss>' };
	} });
	const first = service.refresh();
	const copies = sources.map(item => service.refresh(item.id));
	await vi.waitFor(() => assert.equal(active, 3));
	release();
	await Promise.all([first, ...copies]);
	assert.equal(maximum, 3);
	assert.equal(calls, 6);
	await service.refresh();
	assert.equal(calls, 6);
	await service.shutdown();
});

test('changing a source URL resets its cursor, and shutdown discards a late response', async () => {
	const store = memory();
	const configured = source();
	let release!: () => void;
	let started = false;
	let calls = 0;
	const service = new NewsService(store, memoryNotes(store), () => ({ enabled: true, sources: [configured], views: [] }), { fetch: async (_source, headers) => {
		calls++;
		assert.equal(headers?.['If-None-Match'], undefined);
		if (calls === 1) return { status: 200, text: feed, etag: 'old-etag' };
		started = true;
		await new Promise<void>(resolve => { release = resolve; });
		return { status: 200, text: feed.replace('标题', 'Late data'), etag: 'new-etag' };
	} });
	await service.refresh();
	assert.equal(service.materials()[0]?.backfillReason, 'initial-import');
	configured.url = 'https://example.com/changed.xml';
	const refresh = service.refresh();
	await vi.waitFor(() => assert.ok(started));
	await service.shutdown();
	const before = [...store.files];
	release();
	await refresh;
	assert.equal(service.materials()[0]?.title, '标题');
	assert.deepEqual([...store.files], before);
});


test('policy refresh is opt-in, a trial does not persist data, and a disable-enable cycle rejects an old response', async () => {
	const store = memory();
	const config: NewsSettings = { enabled: true, sources: [source()], views: [], interest: '', analysisEnabled: false, writeDailyNote: false, autoRefresh: false };
	let release!: () => void;
	let pending = false;
	let calls = 0;
	const service = new NewsService(store, memoryNotes(store), () => config, { fetch: async (_source, _headers, signal) => {
		calls++;
		if (pending) { await new Promise<void>(resolve => { release = resolve; }); assert.equal(signal?.aborted, true); }
		return { status: 200, text: feed, etag: 'first' };
	} });
	await service.refreshFromPolicy('startup');
	await service.refreshFromPolicy('visible');
	await service.refreshDue();
	assert.equal(calls, 0);
	const trial = await service.previewSource(source());
	assert.equal(trial.length, 1);
	assert.equal(service.materials().length, 0);
	assert.equal(store.files.size, 0);
	config.refreshOnStartup = true;
	pending = true;
	const previous = service.refreshFromPolicy('startup');
	await vi.waitFor(() => assert.equal(calls, 2));
	config.enabled = false; service.settingsChanged();
	config.enabled = true; service.settingsChanged();
	release(); await previous;
	assert.equal(service.materials().length, 0);
	pending = false;
	await service.refreshFromPolicy('startup');
	assert.equal(service.materials().length, 1);
	assert.equal(calls, 3);
	config.refreshWhenStale = true;
	await service.refreshFromPolicy('visible');
	assert.equal(calls, 3);
	await service.shutdown();
});

function briefText(url: string): string {
	return `## 背景\n见 [来源](<${url}>)\n## 影响\n继续\n## 时间线\n今天`;
}

function analyzed(store: ReturnType<typeof memory>): Promise<NewsService> {
	const service = new NewsService(store, memoryNotes(store), () => ({ enabled: true, sources: [source()], views: [], analysisEnabled: true, interest: '市场', writeDailyNote: false, autoRefresh: false }), {
		fetch: async () => ({ status: 200, text: feed }),
	});
	return service.refresh().then(() =>
		service.analyze({
			run: async (prompt) => {
				return { status: 'succeeded' as const, text: factAnswer(prompt) };
			},
		}).then(() => service),
	);
}

function inboxOf(): NotificationInbox & { sent: NotificationRequest[] } {
	const sent: NotificationRequest[] = [];
	return {
		sent,
		records: [],
		unread: 0,
		available: () => true,
		async send(request) {
			assert.equal(request.target, undefined);
			if (sent.some((item) => item.id === request.id)) return;
			sent.push(request);
		},
		subscribe: () => () => undefined,
	};
}

test('a brief is written once, keeps an annotation, and a failed write leaves the old note', async () => {
	const store = memory();
	const service = await analyzed(store);
	const story = service.stories()[0]!;
	const material = service.materials()[0]!;
	const path = briefPath(story.id);
	const original = serializeBrief(story.id, '旧简报', '旧正文', '我的批注');
	store.files.set(path, original);
	const failed = await service.writeBrief(story.id, { run: async () => ({ status: 'failed', text: briefText(material.originalUrl) }) });
	assert.equal(failed.status, 'failed');
	assert.equal(failed.calls, 1);
	assert.equal(store.files.get(path), original);
	const blockedCalls = { n: 0 };
	const blocked = await service.writeBrief(story.id, { run: async () => { blockedCalls.n += 1; return { status: 'succeeded', text: briefText(material.originalUrl) }; } }, 1);
	assert.equal(blocked.status, 'budget');
	assert.equal(blocked.calls, 0);
	assert.equal(blockedCalls.n, 0);
	const written = await service.writeBrief(story.id, { run: async () => ({ status: 'succeeded', text: briefText(material.originalUrl) }) }, 8);
	assert.equal(written.status, 'complete');
	assert.equal(written.calls, 1);
	assert.match(store.files.get(path) ?? '', /我的批注/);
	assert.match(store.files.get(path) ?? '', /背景/);
	assert.match(store.files.get(path) ?? '', /https:\/\/example.com\/hello/);
	store.failBrief = true;
	const disk = await service.writeBrief(story.id, { run: async () => ({ status: 'succeeded', text: briefText(material.originalUrl) }) }, 8);
	assert.equal(disk.status, 'failed');
	assert.equal(service.run(disk.runId)?.status, 'needs-attention');
	assert.equal(service.run(disk.runId)?.receipt?.state, 'received');
	assert.match(store.files.get(path) ?? '', /我的批注/);
	assert.doesNotMatch(store.files.get(path) ?? '', /替换失败/);
	store.failBrief = false;
	const before = service.callBudget().used;
	const resumed = await service.writeBrief(story.id, { run: async () => { throw new Error('Must not send another CLI call'); } }, 0);
	assert.equal(resumed.status, 'complete'); assert.equal(resumed.runId, disk.runId); assert.equal(resumed.calls, 0);
	assert.equal(service.callBudget().used, before);
	assert.equal(service.brief(story.id)?.path, path);
	await service.clearCache();
	assert.match(service.brief(story.id)?.body ?? '', /我的批注/);
	assert.match(store.files.get(path) ?? '', /背景/);
	await service.shutdown();
});

test('concurrent brief requests share one call and interrupted briefs require explicit charged retry', async () => {
	const store = memory(), service = await analyzed(store), story = service.stories()[0]!, material = service.materials()[0]!;
	let calls = 0;
	const unknown = { run: async () => { calls++; return { status: 'interrupted' as const, text: '', terminalId: 'lost' }; } };
	const [first, duplicate] = await Promise.all([service.writeBrief(story.id, unknown), service.writeBrief(story.id, unknown)]);
	assert.equal(first.runId, duplicate.runId); assert.equal(calls, 1);
	const blocked = await service.writeBrief(story.id, unknown);
	assert.equal(blocked.status, 'needs-attention'); assert.equal(blocked.calls, 0); assert.equal(calls, 1);
	const retry = await service.writeBrief(story.id, { run: async () => { calls++; return { status: 'succeeded', text: briefText(material.originalUrl) }; } }, 20, first.runId);
	assert.equal(retry.status, 'complete'); assert.equal(retry.calls, 1); assert.equal(calls, 2);
	await service.shutdown();
});

test('a durable unsaved brief recovers after restart without a runner or quota reservation', async () => {
	const store = memory(), service = await analyzed(store), story = service.stories()[0]!, material = service.materials()[0]!;
	store.failBrief = true;
	const result = await service.writeBrief(story.id, { run: async () => ({ status: 'succeeded', text: briefText(material.originalUrl) }) });
	const used = service.callBudget().used;
	await service.shutdown(); store.failBrief = false;
	const restarted = new NewsService(store, memoryNotes(store), () => ({ enabled: false, sources: [source()], views: [], analysisEnabled: false }));
	await restarted.ready;
	assert.equal(restarted.run(result.runId)?.status, 'complete');
	assert.equal(restarted.callBudget().used, used);
	assert.match(restarted.brief(story.id)?.body ?? '', /背景/);
	await restarted.shutdown();
});

test('a changed report never exposes old Chinese analysis or sends it into a brief', async () => {
	const store = memory(), service = await analyzed(store), story = service.stories()[0]!;
	await service.shutdown();
	const path = '.nand/news/local/materials.json';
	const saved = JSON.parse(store.files.get(path)!);
	saved.items[0].revision++; saved.items[0].contentHash = 'changed-body';
	store.files.set(path, JSON.stringify(saved));
	const restarted = new NewsService(store, memoryNotes(store), () => ({ enabled: true, sources: [source()], views: [], analysisEnabled: true }));
	await restarted.ready;
	assert.equal(restarted.analyses().length, 0);
	const result = await restarted.writeBrief(story.id, { run: async () => { throw new Error('Stale analysis must not reach the runner'); } });
	assert.equal(result.status, 'failed'); assert.equal(result.calls, 0);
	assert.equal(JSON.parse(store.files.get('.nand/news/local/analyses.json')!).items.length, 1);
	await restarted.shutdown();
});

test('a failed reader-state write leaves the visible read and hidden choices unchanged', async () => {
	const store = memory(), service = await analyzed(store), id = service.materials()[0]!.id;
	const write = store.write;
	store.write = async (path, content) => { if (path.endsWith('/reader-state.json')) throw new Error('Disk full'); await write(path, content); };
	await assert.rejects(service.setReaderChoice(id, 'hidden'));
	assert.equal(service.isHidden(id), false); assert.equal(service.isRead(id), false);
	store.write = write;
	await service.setReaderChoice(id, 'read');
	assert.equal(service.isRead(id), true);
	await service.shutdown();
});

test('the same news run notifies once, opens that run, and still saves when notifications are absent', async () => {
	const store = memory();
	const settings = settingsOf({ enabled: true, sources: [source()], views: [], analysisEnabled: true, interest: '', writeDailyNote: false, autoRefresh: false, notifyOn: 'always' });
	const service = await analyzed(store);
	const story = service.stories()[0]!;
	const material = service.materials()[0]!;
	const inbox = inboxOf();
	const actions = newsActions(service, settings, () => ({
		run: async () => ({ status: 'succeeded' as const, text: briefText(material.originalUrl) }),
	}), { inbox: () => inbox });
	const result = await actions.brief(story.id);
	await actions.publish(result.runId);
	assert.equal(result.status, 'complete');
	assert.equal(inbox.sent.length, 1);
	assert.equal(inbox.sent[0]?.id, `news:${result.runId}:complete`);
	assert.equal(inbox.sent[0]?.channels.includes('in-app'), true);
	const opened: string[] = [];
	const opener = newsOpener((id) => service.run(id), async (resourceId) => {
		opened.push(resourceId);
	});
	const record = { id: inbox.sent[0]!.id, title: 't', body: 'complete', channels: ['in-app'], createdAt: 1, read: false, deliveries: {} } as NotificationRecord;
	assert.equal(opener.canOpen(record), true);
	await opener.open(record);
	assert.deepEqual(opened, [material.id]);
	assert.equal(opener.canOpen({ ...record, id: 'news:missing:failed' }), false);
	const quiet = memory();
	const second = await analyzed(quiet);
	const quietActions = newsActions(second, settings, () => ({
		run: async () => ({ status: 'succeeded' as const, text: briefText(material.originalUrl) }),
	}));
	const saved = await quietActions.brief(second.stories()[0]!.id);
	assert.equal(saved.status, 'complete');
	assert.match(quiet.files.get(saved.path ?? '') ?? '', /背景/);
	await service.shutdown();
	await second.shutdown();
});

test('news notifications default to failures and honor selected available channels and never mode', async () => {
	const store = memory(), service = await analyzed(store);
	const settings = settingsOf({ enabled: true, sources: [source()], views: [], analysisEnabled: true, interest: '', writeDailyNote: false, autoRefresh: false });
	const inbox = inboxOf();
	let succeeds = true;
	const material = service.materials()[0]!, story = service.stories()[0]!;
	const actions = newsActions(service, settings, () => ({ run: async () => ({ status: succeeds ? 'succeeded' as const : 'failed' as const, text: succeeds ? briefText(material.originalUrl) : '' }) }), { inbox: () => inbox });
	await actions.brief(story.id); assert.equal(inbox.sent.length, 0);
	succeeds = false;
	const failed = await actions.brief(story.id); await actions.publish(failed.runId);
	assert.equal(inbox.sent.length, 1); assert.deepEqual(inbox.sent[0]!.channels, ['in-app']); assert.equal(inbox.sent[0]!.target, undefined);
	await settings.update(draft => { draft.notificationChannels = ['system']; });
	await actions.brief(story.id); assert.deepEqual(inbox.sent[1]!.channels, ['system']);
	inbox.available = () => false; await actions.brief(story.id); assert.equal(inbox.sent.length, 2);
	inbox.available = () => true; await settings.update(draft => { draft.notifyOn = 'never'; });
	await actions.brief(story.id); assert.equal(inbox.sent.length, 2);
	await actions.dispose(); await service.shutdown();
});

test('unclassified raw reports do not invent event heat from title overlap', async () => {
	const store = memory();
	const published = new Date(Date.now() - 3_600_000).toUTCString();
	const beta = normalizeNewsSource({ id: 'beta', name: 'Beta', url: 'https://example.com/b.xml', type: 'rss', enabled: true, participation: 'editorial', intervalMinutes: 30 });
	const settings = settingsOf({ enabled: true, sources: [source(), beta!], views: [], interest: '', analysisEnabled: false, writeDailyNote: false, autoRefresh: false });
	const service = new NewsService(store, memoryNotes(store), () => settings.get(), {
		fetch: async (item) => ({ status: 200, text: `<rss><channel><item><title>Heat story</title><link>https://example.com/${item.id}</link><pubDate>${published}</pubDate><description>same</description></item></channel></rss>` }),
	});
	await service.refresh();
	const saved = JSON.parse(store.files.get('.nand/news/local/heat.json') ?? '{"items":[]}') as { items: { complete?: boolean; ruleVersion?: string }[] };
	assert.equal(saved.items.length, 0);
	const kept = store.files.get('.nand/news/local/heat.json');
	await service.refresh();
	assert.equal(store.files.get('.nand/news/local/heat.json'), kept);
	await service.shutdown();
});

test('only the observation clock creates an hour; one-participant events and restart keep honest history', async () => {
	const now = Date.UTC(2026, 9, 10, 12);
	const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
	const store = memory();
	const service = await analyzed(store);
	try {
		assert.equal(service.heat().length, 0);
		assert.equal(service.hot().length, 0);
		await service.observeHeat(now);
		assert.equal(service.heat().length, 1);
		assert.equal(service.heat()[0]?.participants, 1);
		assert.equal(service.heat()[0]?.hour, now);
		await service.observeHeat(now);
		assert.equal(service.heat().length, 1);
		clock.mockReturnValue(now + 24 * 3_600_000);
		const reopened = new NewsService(store, memoryNotes(store), () => ({ enabled: true, sources: [source()], views: [] }));
		await reopened.ready;
		assert.deepEqual(reopened.heat().map(item => item.hour), [now]);
		await reopened.shutdown();
	} finally { clock.mockRestore(); await service.shutdown(); }
});

vi.stubGlobal('DOMParser', DOMParser);
