import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { TextStorage } from '../../../shared/storage/ports';
import type { NotificationInbox, NotificationRecord, NotificationRequest } from '../../notifications/api';
import { newsOpener } from '../contrib/notifications';
import { normalizeNewsSource, type NewsSource } from '../core/model';
import { briefPath } from '../platform/notes';
import type { NewsSettings } from '../settings';
import { newsActions } from './news-actions';
import { NewsService } from './news-service';

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
		tier: 'primary',
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
const axes = { relevance: 80, novelty: 70, quality: 60, impact: 50, clarity: 90 };

function briefText(url: string): string {
	return `## 背景\n见 ${url}\n## 影响\n继续\n## 时间线\n今天`;
}

function analyzed(store: ReturnType<typeof memory>): Promise<NewsService> {
	const service = new NewsService(store, () => ({ enabled: true, sources: [source()], views: [], analysisEnabled: true, interest: '市场', dailyEditionEnabled: false, autoRefresh: false }), {
		fetch: async () => ({ status: 200, text: feed }),
	});
	return service.refresh().then(() =>
		service.analyze({
			run: async (prompt) => {
				const id = prompt.match(/id=(\S+)/)?.[1] ?? '';
				return { status: 'complete' as const, text: JSON.stringify([{ id, axes, target: 'featured' }]) };
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
	store.files.set(path, '旧简报\n## Notes\n我的批注\n');
	const failed = await service.writeBrief(story.id, { run: async () => ({ status: 'failed', text: briefText(material.originalUrl) }) });
	assert.equal(failed.status, 'failed');
	assert.equal(failed.calls, 1);
	assert.equal(store.files.get(path), '旧简报\n## Notes\n我的批注\n');
	const blockedCalls = { n: 0 };
	const blocked = await service.writeBrief(story.id, { run: async () => { blockedCalls.n += 1; return { status: 'complete', text: briefText(material.originalUrl) }; } }, 1);
	assert.equal(blocked.status, 'budget');
	assert.equal(blocked.calls, 0);
	assert.equal(blockedCalls.n, 0);
	const written = await service.writeBrief(story.id, { run: async () => ({ status: 'complete', text: briefText(material.originalUrl) }) }, 8);
	assert.equal(written.status, 'complete');
	assert.equal(written.calls, 1);
	assert.match(store.files.get(path) ?? '', /我的批注/);
	assert.match(store.files.get(path) ?? '', /背景/);
	assert.match(store.files.get(path) ?? '', /https:\/\/example.com\/hello/);
	store.failBrief = true;
	const disk = await service.writeBrief(story.id, { run: async () => ({ status: 'complete', text: briefText(material.originalUrl) }) }, 8);
	assert.equal(disk.status, 'failed');
	assert.match(store.files.get(path) ?? '', /我的批注/);
	assert.doesNotMatch(store.files.get(path) ?? '', /替换失败/);
	await service.clearCache();
	assert.match(store.files.get(path) ?? '', /背景/);
	await service.shutdown();
});

test('the same news run notifies once, opens that run, and still saves when notifications are absent', async () => {
	const store = memory();
	const settings = settingsOf({ enabled: true, sources: [source()], views: [], analysisEnabled: true, interest: '', dailyEditionEnabled: false, autoRefresh: false });
	const service = await analyzed(store);
	const story = service.stories()[0]!;
	const material = service.materials()[0]!;
	const inbox = inboxOf();
	const actions = newsActions(service, settings, () => ({
		run: async () => ({ status: 'complete' as const, text: briefText(material.originalUrl) }),
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
		service.focus(resourceId);
	});
	const record = { id: inbox.sent[0]!.id, title: 't', body: 'complete', channels: ['in-app'], createdAt: 1, read: false, deliveries: {} } as NotificationRecord;
	assert.equal(opener.canOpen(record), true);
	await opener.open(record);
	assert.deepEqual(opened, [material.id]);
	assert.equal(service.focusedId(), material.id);
	assert.equal(opener.canOpen({ ...record, id: 'news:missing:failed' }), false);
	const quiet = memory();
	const second = await analyzed(quiet);
	const quietActions = newsActions(second, settings, () => ({
		run: async () => ({ status: 'complete' as const, text: briefText(material.originalUrl) }),
	}));
	const saved = await quietActions.brief(second.stories()[0]!.id);
	assert.equal(saved.status, 'complete');
	assert.match(quiet.files.get(saved.path ?? '') ?? '', /背景/);
	await service.shutdown();
	await second.shutdown();
});

test('refresh records one closed heat hour and does not write it again', async () => {
	const store = memory();
	const published = new Date(Date.now() - 3_600_000).toUTCString();
	const beta = normalizeNewsSource({ id: 'beta', name: 'Beta', url: 'https://example.com/b.xml', type: 'rss', enabled: true, participation: 'editorial', intervalMinutes: 30 });
	const settings = settingsOf({ enabled: true, sources: [source(), beta!], views: [], interest: '', analysisEnabled: false, dailyEditionEnabled: false, autoRefresh: false });
	const service = new NewsService(store, () => settings.get(), {
		fetch: async (item) => ({ status: 200, text: `<rss><channel><item><title>Heat story</title><link>https://example.com/${item.id}</link><pubDate>${published}</pubDate><description>same</description></item></channel></rss>` }),
	});
	await service.refresh();
	const saved = JSON.parse(store.files.get('.nand/news/local/heat.json') ?? '{"items":[]}') as { items: { complete?: boolean; ruleVersion?: string }[] };
	assert.equal(saved.items.length, 1);
	assert.equal(saved.items[0]?.complete, true);
	assert.equal(saved.items[0]?.ruleVersion, 'heat-v1');
	const kept = store.files.get('.nand/news/local/heat.json');
	await service.refresh();
	assert.equal(store.files.get('.nand/news/local/heat.json'), kept);
	await service.shutdown();
});
