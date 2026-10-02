import assert from 'node:assert/strict';
import { CommentStore, getCommentStore, registerCommentStore, unregisterCommentStore, type CommentFs } from '../src/core/comments/store';
import { beginCommentStoreActivation } from '../src/platform/obsidian/comments/store-handoff';

const input = { start: 0, end: 5, quote: { exact: 'alpha', prefix: '', suffix: '' }, text: 'original' };
const root = '.nand/editor/comments/';
function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>(done => { resolve = done; });
	return { promise, resolve };
}

export async function verifyCommentHandoff(): Promise<void> {
	let checks = 0;
	for (const phase of ['journal', 'sidecar', 'index', 'cleanup']) {
		for (const fail of [false, true]) {
			const app = {}, files = new Map<string, string>();
			const entered = deferred(), release = deferred();
			let armed = false;
			const intercept = async (path: string, removing: boolean) => {
				const match = phase === 'journal' ? path === root + 'pending.json' && !removing
					: phase === 'sidecar' ? path.includes('/files/') && !removing
						: phase === 'index' ? path === root + 'index.json'
							: path.includes('/files/') && removing;
				if (!armed || !match) return;
				armed = false; entered.resolve(); await release.promise;
				if (fail) throw Error('EIO handoff');
			};
			const fs: CommentFs = {
				read: async p => { if (!files.has(p)) throw Error('ENOENT'); return files.get(p)!; },
				exists: async p => files.has(p),
				write: async (p, v) => { await intercept(p, false); files.set(p, v); },
				remove: async p => { await intercept(p, true); files.delete(p); },
			};
			const first = beginCommentStoreActivation(app);
			await first.ready();
			const old = new CommentStore(fs, { debounceMs: 1e6 });
			const thread = await old.add('note.md', input); await old.flush();
			if (phase === 'sidecar') await old.reply(thread.id, 'accepted');
			else await old.remove(thread.id);
			armed = true; first.cancel(); first.retire(old);
			await entered.promise;
			await assert.rejects(old.reply(thread.id, 'late callback'), /closed/);
			const next = beginCommentStoreActivation(app);
			let ready = false;
			const waiting = next.ready().then(() => { ready = true; });
			const rejected = fail ? assert.rejects(waiting, /EIO handoff/) : null;
			await Promise.resolve(); assert.equal(ready, false, 'New generation waits for durable storage');
			await beginCommentStoreActivation({}).ready();
			assert.equal(ready, false, 'Other Vaults are independent');
			release.resolve();
			if (rejected) { await rejected; assert.equal(ready, false); await next.ready(); }
			else await waiting;
			const fresh = new CommentStore(fs, { debounceMs: 1e6 });
			const loaded = await fresh.loadFile('note.md');
			if (phase === 'sidecar') assert.deepEqual(loaded[0]!.thread.map(m => m.text), ['original', 'accepted']);
			else { assert.deepEqual(loaded, []); await assert.rejects(fresh.reply(thread.id, 'ghost'), /not found/); }
			assert.equal(files.has(root + 'pending.json'), false);
			await fresh.close(); checks++;
		}
	}
	const app = {};
	const stale = beginCommentStoreActivation(app);
	const latest = beginCommentStoreActivation(app);
	stale.cancel(); await stale.ready(); await latest.ready();
	assert.equal(stale.isCurrent(), false);
	assert.equal(latest.isCurrent(), true, 'Old cancellation cannot invalidate a new activation');
	const fs: CommentFs = { read: async () => '', write: async () => {}, exists: async () => false, remove: async () => {} };
	const old = new CommentStore(fs), fresh = new CommentStore(fs);
	registerCommentStore(fresh); unregisterCommentStore(old); assert.equal(getCommentStore(), fresh);
	unregisterCommentStore(fresh); await old.close(); await fresh.close();
	console.log(`Comment handoff: ${checks} delayed/failing persistence cases and generation isolation passed`);
}
