import assert from 'node:assert/strict';
import { CommentStore, type CommentFs } from '../src/modules/comments/core/store';

const timers = { set: (callback: () => void, ms: number) => setTimeout(callback, ms), clear: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>) };

const root = '.nand/editor/comments/';
const indexPath = root + 'index.json';
const input = (text: string) => ({ quote: { exact: 'alpha', prefix: '', suffix: '' }, start: 0, end: 5, text });
export async function verifyCommentStorage(): Promise<void> {
	let checks = 0;
	for (const failure of [
		'sidecar-read',
		'index-read',
		'sidecar-json',
		'index-json',
		'sidecar-shape',
		'index-shape',
		'missing-sidecar',
		'invalid-message',
	]) {
		const files = new Map<string, string>();
		let failRead = '';
		const fs: CommentFs = {
			exists: async (p) => files.has(p),
			read: async (p) => {
				if (p === failRead) throw Error('EIO');
				if (!files.has(p)) throw Error('ENOENT');
				return files.get(p)!;
			},
			write: async (p, v) => {
				files.set(p, v);
			},
			remove: async (p) => {
				files.delete(p);
			},
		};
		const original = new CommentStore(fs, { timers, debounceMs: 1e6 });
		await original.add('a.md', input('old'));
		await original.flush();
		original.dispose();
		const sidecar = [...files.keys()].find((p) => p.includes('/files/'))!;
		const saved = new Map(files);
		const target = failure.startsWith('index') ? indexPath : sidecar;
		if (failure.endsWith('read')) failRead = target;
		else if (failure.endsWith('json')) files.set(target, '{broken');
		else if (failure.endsWith('shape')) files.set(target, '{"version":1}');
		else if (failure === 'invalid-message') {
			const body = JSON.parse(files.get(sidecar)!);
			body.comments[0].thread.push({ text: 'damaged message' });
			files.set(sidecar, JSON.stringify(body));
		} else files.delete(sidecar);
		const store = new CommentStore(fs, { timers, debounceMs: 1e6 });
		try {
			const before = new Map(files);
			await assert.rejects(store.loadFile('a.md'));
			assert.equal(store.isLoaded('a.md'), false);
			await assert.rejects(store.add('a.md', input('new')));
			assert.deepEqual(files, before);
			failRead = '';
			for (const [k, v] of saved) files.set(k, v);
			await store.add('a.md', input('new'));
			await store.flush();
			const reload = new CommentStore(fs, { timers });
			assert.deepEqual(
				(await reload.loadFile('a.md')).map((t) => t.thread[0]!.text),
				['old', 'new'],
			);
			reload.dispose();
			checks++;
		} finally {
			store.dispose();
		}
	}
	for (const phase of ['journal', 'sidecar', 'index', 'cleanup'])
		for (const restart of [false, true]) {
			const files = new Map<string, string>();
			let failing = false;
			let failures = 0;
			const fs: CommentFs = {
				exists: async (p) => files.has(p),
				read: async (p) => {
					if (!files.has(p)) throw Error('ENOENT');
					return files.get(p)!;
				},
				write: async (p, v) => {
					if (
						failing &&
						((phase === 'journal' && p.endsWith('pending.json')) ||
							(phase === 'sidecar' && p.includes('/files/')) ||
							(phase === 'index' && p === indexPath))
					) {
						failures++;
						throw Error('EIO');
					}
					files.set(p, v);
				},
				remove: async (p) => {
					if (failing && phase === 'cleanup' && p.includes('/files/')) {
						failures++;
						throw Error('EIO');
					}
					files.delete(p);
				},
			};
			const store = new CommentStore(fs, { timers, debounceMs: 1e6 });
			try {
				await store.add('a.md', input('preserved'));
				await store.flush();
				const old = [...files.keys()].find((p) => p.includes('/files/'))!;
				failing = true;
				await assert.rejects(store.renamePath('a.md', 'b.md'));
				assert.ok(files.has(old), 'old copy survives failure');
				assert.ok(failures > 0);
				failing = false;
				if (!restart) {
					await store.flush();
				}
				const reload = new CommentStore(fs, { timers });
				const expectedPath = restart && phase === 'journal' ? 'a.md' : 'b.md';
				assert.equal((await reload.loadFile(expectedPath)).length, 1);
				if (expectedPath === 'b.md') {
					assert.equal(files.has(old), false);
					assert.equal((await reload.loadFile('a.md')).length, 0);
				}
				reload.dispose();
				checks++;
			} finally {
				store.dispose();
			}
		}
	// A failure in the second sidecar must retain every pending file, including across restart.
	const files = new Map<string, string>();
	let writes = 0;
	let fail = true;
	const fs: CommentFs = {
		exists: async (p) => files.has(p),
		read: async (p) => files.get(p)!,
		write: async (p, v) => {
			if (p.includes('/files/') && ++writes === 2 && fail) throw Error('EIO');
			files.set(p, v);
		},
		remove: async (p) => {
			files.delete(p);
		},
	};
	const store = new CommentStore(fs, { timers, debounceMs: 1e6 });
	await store.add('a.md', input('a'));
	await store.add('b.md', input('b'));
	await assert.rejects(store.flush());
	store.dispose();
	fail = false;
	const reload = new CommentStore(fs, { timers });
	assert.equal((await reload.loadFile('a.md')).length, 1);
	assert.equal((await reload.loadFile('b.md')).length, 1);
	reload.dispose();
	checks++;
	// Synchronous editor changes during an awaited sidecar write need a second revision.
	let release!: () => void, entered!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const waiting = new Promise<void>((resolve) => {
		entered = resolve;
	});
	let hold = true;
	const concurrentFs: CommentFs = {
		...fs,
		write: async (p, v) => {
			if (p.includes('/files/') && hold) {
				hold = false;
				entered();
				await gate;
			}
			files.set(p, v);
		},
	};
	const concurrent = new CommentStore(concurrentFs, { timers, debounceMs: 1e6 });
	await concurrent.add('c.md', input('during-write'));
	const flushing = concurrent.flush();
	await waiting;
	concurrent.applyChanges('c.md', { mapPos: (pos) => pos + 1 }, ' alpha');
	release();
	await flushing;
	concurrent.dispose();
	const reloaded = new CommentStore(fs, { timers });
	const [thread] = await reloaded.loadFile('c.md');
	assert.equal(thread!.target.start, 1);
	assert.equal(thread!.target.end, 6);
	reloaded.dispose();
	checks++;
	console.log(`Comment storage: ${checks} failure/recovery scenarios passed`);
}
