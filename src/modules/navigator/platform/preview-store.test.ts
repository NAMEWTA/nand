// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test } from 'vitest';
import { CACHE_VERSION } from '../core/cache';
import { createMemoryCache } from './cache-store';
import { PreviewStore, type PreviewSource, type Scheduler } from './preview-store';

interface FakeFile { mtime: number; text: string; image?: string }

function setup(initial: Record<string, FakeFile>, images: () => string[] = () => ['cover']) {
	const files = new Map(Object.entries(initial));
	const reads: string[] = [];
	const state = { ready: true, gated: false };
	const gates: Array<() => void> = [];
	const source: PreviewSource = {
		mtime: (path) => files.get(path)?.mtime,
		isMarkdown: (path) => path.endsWith('.md'),
		readText(path) {
			reads.push(path);
			const file = files.get(path);
			const text = file ? file.text : null;
			// A gated read returns the text as it was when the read started, once released.
			if (state.gated) return new Promise((resolve) => gates.push(() => resolve(text)));
			return Promise.resolve(text);
		},
		propertyImage: (path) => files.get(path)?.image,
		resolveImage: (link) => `assets/${link}`,
		title: (path) => path.replace(/\.md$/, ''),
		metadataReady: () => state.ready,
	};
	const timers: Array<() => void> = [];
	const cancelled: number[] = [];
	const scheduler: Scheduler = { now: () => 0, yield: () => Promise.resolve(), later: (callback) => { const id = timers.push(callback); return () => { cancelled.push(id); timers[id - 1] = () => undefined; }; } };
	const cache = createMemoryCache();
	const make = () => new PreviewStore({ cache, source, scheduler, imageProperties: images, capacity: 100 });
	return { files, reads, cache, make, state, gates, cancelled, flush: () => { while (timers.length) timers.shift()!(); } };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

test('a requested note is processed once and its record is reused until the file changes', async () => {
	const t = setup({ 'a.md': { mtime: 1, text: '# a\n\nHello **world** ![[pic.png]]' } });
	const store = t.make();
	await store.load();
	store.request('a.md');
	await settle();
	expect(store.get('a.md')).toMatchObject({ preview: 'Hello world', image: 'assets/pic.png', contentMtime: 1 });
	store.request('a.md');
	await settle();
	expect(t.reads).toEqual(['a.md']);
	t.files.set('a.md', { mtime: 2, text: 'Changed' });
	store.request('a.md');
	await settle();
	expect(store.get('a.md')?.preview).toBe('Changed');
	expect(t.reads).toEqual(['a.md', 'a.md']);
	store.dispose();
});

test('records persist: a second session starts with fresh records and reads nothing', async () => {
	const t = setup({ 'a.md': { mtime: 1, text: 'one' }, 'b.md': { mtime: 1, text: 'two' } });
	const first = t.make();
	await first.load();
	first.enqueue(['a.md', 'b.md']);
	await settle();
	first.dispose();
	await settle();
	expect((await t.cache.all()).map((record) => record.path).sort()).toEqual(['a.md', 'b.md']);
	t.reads.length = 0;
	const second = t.make();
	await second.load();
	second.enqueue(['a.md', 'b.md']);
	await settle();
	expect(t.reads).toEqual([]);
	expect(second.get('b.md')?.preview).toBe('two');
	t.files.set('b.md', { mtime: 5, text: 'two!' });
	second.enqueue(['a.md', 'b.md']);
	await settle();
	expect(t.reads).toEqual(['b.md']);
	second.dispose();
});

test('changing the image properties reprocesses only the image part', async () => {
	let images = ['cover'];
	const t = setup({ 'a.md': { mtime: 1, text: 'text ![[body.png]]', image: 'front.png' } }, () => images);
	const store = t.make();
	await store.load();
	store.request('a.md');
	await settle();
	expect(store.get('a.md')?.image).toBe('assets/front.png');
	images = ['thumb'];
	t.files.set('a.md', { mtime: 1, text: 'text ![[body.png]]' });
	store.request('a.md');
	await settle();
	expect(store.get('a.md')?.image).toBe('assets/body.png');
	store.dispose();
});

test('visible requests jump ahead of the background queue', async () => {
	const files: Record<string, FakeFile> = {};
	for (let i = 0; i < 5; i++) files[`n${i}.md`] = { mtime: 1, text: `note ${i}` };
	const t = setup(files);
	const store = t.make();
	await store.load();
	store.enqueue(Object.keys(files));
	store.request('n4.md');
	await settle();
	// n0 had already started when the visible request arrived; n4 is next, ahead of n1..n3.
	expect(t.reads.slice(0, 2)).toEqual(['n0.md', 'n4.md']);
	store.dispose();
});

test('rename keeps the record, remove drops it, clear rebuilds from the notes', async () => {
	const t = setup({ 'a.md': { mtime: 1, text: 'alpha' } });
	const store = t.make();
	await store.load();
	store.request('a.md');
	await settle();
	store.rename('a.md', 'b.md');
	expect(store.get('b.md')?.preview).toBe('alpha');
	expect(store.get('a.md')).toBeUndefined();
	store.remove('b.md');
	expect(store.get('b.md')).toBeUndefined();
	t.files.set('c.md', { mtime: 1, text: 'gamma' });
	store.request('c.md');
	await settle();
	await store.clear();
	expect(store.get('c.md')).toBeUndefined();
	expect(await t.cache.all()).toEqual([]);
	store.dispose();
});

test('records from an older cache version are ignored', async () => {
	const t = setup({ 'a.md': { mtime: 1, text: 'fresh' } });
	await t.cache.putMany([{ path: 'a.md', version: CACHE_VERSION - 1, contentMtime: 1, imageMtime: 1, imageSig: 'cover', preview: 'stale', image: null }]);
	const store = t.make();
	await store.load();
	expect(store.get('a.md')).toBeUndefined();
	store.request('a.md');
	await settle();
	expect(store.get('a.md')?.preview).toBe('fresh');
	store.dispose();
});

test('a file that disappears while queued is skipped', async () => {
	const t = setup({ 'a.md': { mtime: 1, text: 'x' } });
	const store = t.make();
	await store.load();
	store.request('a.md');
	t.files.delete('a.md');
	await settle();
	expect(store.get('a.md')).toBeUndefined();
	store.dispose();
});

test('an image found before the metadata is parsed stays stale and is completed when the metadata arrives', async () => {
	const t = setup({ 'a.md': { mtime: 1, text: 'body ![[body.png]]', image: 'front.png' } });
	t.state.ready = false;
	const store = t.make();
	await store.load();
	store.request('a.md');
	await settle();
	// Body image only, and the record is not marked fresh for the image.
	expect(store.get('a.md')).toMatchObject({ image: 'assets/body.png', imageMtime: -1, contentMtime: 1 });
	store.request('a.md');
	await settle();
	expect(t.reads).toEqual(['a.md', 'a.md']);
	t.state.ready = true;
	store.enqueue(['a.md']);
	await settle();
	expect(store.get('a.md')).toMatchObject({ image: 'assets/front.png', imageMtime: 1 });
	store.enqueue(['a.md']);
	await settle();
	expect(t.reads).toHaveLength(3);
	store.dispose();
});

test('a note modified while it is being read is read again and ends with the new text', async () => {
	const t = setup({ 'a.md': { mtime: 1, text: 'old' } });
	const store = t.make();
	await store.load();
	t.state.gated = true;
	store.request('a.md');
	await settle();
	expect(t.gates).toHaveLength(1);
	t.files.set('a.md', { mtime: 2, text: 'new' });
	store.request('a.md');
	t.gates.shift()!();
	await settle();
	t.state.gated = false;
	t.gates.shift()?.();
	await settle();
	expect(store.get('a.md')).toMatchObject({ preview: 'new', contentMtime: 2 });
	expect(store.pending).toBe(0);
	store.dispose();
});

test('a modification that only shows up as a new mtime after the read also triggers another pass', async () => {
	const t = setup({ 'a.md': { mtime: 1, text: 'old' } });
	const store = t.make();
	await store.load();
	t.state.gated = true;
	store.enqueue(['a.md']);
	await settle();
	t.files.set('a.md', { mtime: 2, text: 'new' });
	t.state.gated = false;
	t.gates.shift()!();
	await settle();
	expect(store.get('a.md')).toMatchObject({ preview: 'new', contentMtime: 2 });
	store.dispose();
});

test('clearing while a read is running leaves the new generation with a worker', async () => {
	const t = setup({ 'a.md': { mtime: 1, text: 'alpha' }, 'b.md': { mtime: 1, text: 'beta' } });
	const store = t.make();
	await store.load();
	t.state.gated = true;
	store.enqueue(['a.md']);
	await settle();
	await store.clear();
	t.state.gated = false;
	store.enqueue(['b.md']);
	t.gates.shift()!();
	await settle();
	expect(store.get('b.md')?.preview).toBe('beta');
	expect(store.get('a.md')).toBeUndefined();
	expect(store.pending).toBe(0);
	store.dispose();
});

test('a refresh requested for the path being read during a clear is not lost', async () => {
	const t = setup({ 'a.md': { mtime: 1, text: 'alpha' } });
	const store = t.make();
	await store.load();
	t.state.gated = true;
	store.enqueue(['a.md']);
	await settle();
	await store.clear();
	t.state.gated = false;
	store.enqueue(['a.md']);
	t.gates.shift()!();
	await settle();
	expect(store.get('a.md')?.preview).toBe('alpha');
	store.dispose();
});

test('after a rebuild the store keeps persisting, and disposing keeps the rebuilt records', async () => {
	const t = setup({ 'a.md': { mtime: 1, text: 'alpha' } });
	const store = t.make();
	await store.load();
	store.request('a.md');
	await settle();
	await store.clear();
	expect(await t.cache.all()).toEqual([]);
	store.enqueue(['a.md']);
	await settle();
	await store.dispose();
	expect((await t.cache.all()).map((record) => record.path)).toEqual(['a.md']);
});

test('disposing cancels the pending flush timer', async () => {
	const t = setup({ 'a.md': { mtime: 1, text: 'alpha' } });
	const store = t.make();
	await store.load();
	store.request('a.md');
	await settle();
	store.rename('a.md', 'b.md');
	await store.dispose();
	expect(t.cancelled.length).toBeGreaterThan(0);
	expect((await t.cache.all()).map((record) => record.path)).toContain('b.md');
});

test('editing the cover of an existing note: stale metadata gives a provisional image, the new metadata corrects it', async () => {
	const t = setup({ 'a.md': { mtime: 1, text: 'body', image: 'old.png' } });
	const store = t.make();
	await store.load();
	store.request('a.md');
	await settle();
	expect(store.get('a.md')).toMatchObject({ image: 'assets/old.png', imageMtime: 1 });
	// The note is edited: the text changed, the metadata cache still describes the old text.
	t.files.set('a.md', { mtime: 2, text: 'body', image: 'old.png' });
	t.state.ready = false;
	store.enqueue(['a.md']);
	await settle();
	expect(store.get('a.md')).toMatchObject({ contentMtime: 2, imageMtime: -1 });
	// The metadata arrives with the new cover; the runtime enqueues the note again.
	t.files.set('a.md', { mtime: 2, text: 'body', image: 'new.png' });
	t.state.ready = true;
	store.enqueue(['a.md']);
	await settle();
	expect(store.get('a.md')).toMatchObject({ image: 'assets/new.png', imageMtime: 2 });
	store.dispose();
});
