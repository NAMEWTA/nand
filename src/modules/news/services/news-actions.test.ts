import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { TextStorage } from '../../../shared/storage/ports';
import type { NewsMaterial } from '../core/model';
import type { NewsSettings } from '../settings';
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
	test('enable, refresh, favorite, opml and the daily edition reach the service', async () => {
		const store = memory();
		const settings = settingsOf({ enabled: false, sources: [], views: [], interest: '', analysisEnabled: true, dailyEditionEnabled: false, autoRefresh: false });
		const service = new NewsService(store, () => settings.get(), { fetch: async () => ({ status: 200, text: '<rss><channel><item><title>Hello</title><link>https://example.com/hello</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>' }) });
		const actions = newsActions(service, settings, () => ({
			run: async (request) => {
				const id = request.prompt.match(/id=(\S+)/)?.[1] ?? '';
				return { status: 'complete' as const, text: JSON.stringify([{ id, axes: { relevance: 80, novelty: 70, quality: 60, impact: 50, clarity: 90 }, target: 'featured' }]) };
			},
		}));
		await service.ready;
		assert.equal(actions.edition(), undefined);
		await actions.enable();
		assert.equal(settings.get().enabled, true);
		const imported = await actions.importOpml('<opml><body><outline text="Example" xmlUrl="https://example.com/feed.xml"/></body></opml>');
		assert.equal(imported, 1);
		assert.equal(await actions.addSource('https://example.com/hello.xml'), true);
		await service.refresh();
		assert.equal(service.materials().length, 1);
		assert.match(store.files.get('.nand/news/local/materials.json') ?? '', /Hello/);
		const material = service.materials()[0] as NewsMaterial;
		await actions.favorite(material, 'keep this');
		const favorite = [...store.files.entries()].find(([path]) => path.includes('/favorites/'));
		assert.match(favorite?.[1] ?? '', /keep this/);
		await settings.update((draft) => {
			draft.dailyEditionEnabled = true;
		});
		const edition = actions.edition();
		assert.equal(edition?.date, new Date().toISOString().slice(0, 10));
		assert.equal(await actions.analyze(), 'complete');
		await service.shutdown();
	});
});
