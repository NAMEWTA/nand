import { test, expect } from 'vitest';
import { verifyCommentStorage } from '../../../scripts/verify-comment-storage';
import { verifyCommentHandoff } from '../../../scripts/verify-comment-handoff';
import { createAnchor } from './core/anchor';
import { CommentStore, type CommentFs } from './core/store';
import { createCommentsService } from './services/comments';
import { DEFAULT_COMMENTS_SETTINGS } from './settings';
import { ChangeSet } from '@codemirror/state';
import { locateAnchor } from './core/anchor';
export const timers = { set: (callback: () => void, ms: number) => setTimeout(callback, ms), clear: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>) };
export function memoryFs(): CommentFs & { files: Map<string, string> } {
	const files = new Map<string, string>();
	return { files, read: async path => { if (!files.has(path)) throw new Error('ENOENT'); return files.get(path)!; }, write: async (path, body) => { files.set(path, body); }, remove: async path => { files.delete(path); }, exists: async path => files.has(path) };
}
test('sidecar queue, partial writes, concurrent changes and activation handoff', async () => { await verifyCommentStorage(); await verifyCommentHandoff(); });
test('v2 round trip, author ownership, edit/reply/delete/restore, rename and deletion', async () => {
	const fs = memoryFs(), store = new CommentStore(fs, { timers, debounceMs: 1e6 });
	const source = 'alpha\nbeta';
	const thread = await store.add('a.md', { anchor: createAnchor(source, 0, 0), text: 'root', author: 'Alice' });
	await expect(store.editMessage(thread.id, thread.messages[0]!.id, 'bad', 'Bob')).rejects.toThrow('author');
	await store.editMessage(thread.id, thread.messages[0]!.id, 'edited', 'Alice');
	await store.reply(thread.id, 'reply', 'Bob'); await store.flush();
	const index = JSON.parse(fs.files.get('.nand/editor/comments/index.json')!);
	expect(index.version).toBe(2); expect(index.files['a.md'].hash).toMatch(/^[a-f0-9]{16}$/);
	const body = JSON.parse(fs.files.get(`.nand/editor/comments/files/${index.files['a.md'].hash}.json`)!);
	expect(body.version).toBe(2); expect(body.threads[0]).toMatchObject({ kind: 'line', anchor: { text: 'alpha', lineHint: 1 }, messages: [{ author: 'Alice', text: 'edited', editedAt: expect.any(String) }, { author: 'Bob', text: 'reply' }] });
	const removed = await store.removeReply(thread.id, thread.messages[1]!.id); expect(thread.messages).toHaveLength(1); await store.restoreReply(thread.id, removed!);
	await store.resolve(thread.id); await store.reopen(thread.id); await store.renamePath('a.md', 'moved/a.md');
	expect((await store.listFiles()).map(file => file.path)).toEqual(['moved/a.md']);
	await store.close(); const fresh = new CommentStore(fs, { timers }); expect(await fresh.loadFile('moved/a.md')).toHaveLength(1);
	await fresh.deletePath('moved/a.md'); expect(await fresh.listFiles()).toEqual([]); await fresh.close(); expect(source).toBe('alpha\nbeta');
});
test('v1 index and pending data remain byte-for-byte, ignored and never overwritten', async () => {
	for (const pending of [false, true]) {
		const fs = memoryFs(), legacy = JSON.stringify(pending ? { index: { version: 1, files: {} }, files: {}, remove: [] } : { version: 1, files: { 'old.md': { hash: '1234567890abcdef' } } });
		const path = `.nand/editor/comments/${pending ? 'pending' : 'index'}.json`; fs.files.set(path, legacy);
		const store = new CommentStore(fs, { timers, debounceMs: 1e6 }); expect(await store.loadFile('old.md')).toEqual([]); expect(store.legacyData).toBe(true);
		await expect(store.add('new.md', { anchor: createAnchor('new', 0, 3), text: 'new' })).rejects.toThrow('Legacy'); await store.close(); expect(fs.files.get(path)).toBe(legacy); store.dispose();
	}
});
test('deleted text stays orphaned until explicit reattach; initial stale offsets are not mapped', async () => {
	const fs = memoryFs(), store = new CommentStore(fs, { timers, debounceMs: 1e6 });
	const thread = await store.add('a.md', { anchor: createAnchor('alpha', 0, 5), text: 'root' }); await store.flush(); store.dispose();
	const reload = new CommentStore(fs, { timers, debounceMs: 1e6 }); await reload.loadFile('a.md');
	reload.applyChanges('a.md', { mapPos: pos => pos + 10 }, 'xxxxxxxxxxalpha', 'alpha'); expect(reload.threadsFor('a.md')[0]!.anchor.start).toBe(0);
	reload.reconcile('a.md', 'xxxxxxxxxxalpha'); await reload.flush(); expect(reload.threadsFor('a.md')[0]!.anchor.start).toBe(10);
	reload.applyChanges('a.md', { mapPos: () => 0 }, '', 'xxxxxxxxxxalpha'); expect(reload.threadsFor('a.md')[0]!.status).toBe('orphaned');
	reload.reconcile('a.md', 'alpha'); await reload.flush(); expect(reload.threadsFor('a.md')[0]!.status).toBe('orphaned');
	await reload.reanchor(thread.id, createAnchor('alpha', 0, 5)); expect(reload.threadsFor('a.md')[0]!.status).toBe('open'); await reload.close();
});
test('retrying a failed durable add does not duplicate accepted draft', async () => {
	const fs = memoryFs(), write = fs.write; let fail = true;
	fs.write = async (path, body) => { if (fail) throw new Error('EIO'); await write(path, body); };
	const store = new CommentStore(fs, { timers, debounceMs: 1e6 }), service = createCommentsService(store, () => DEFAULT_COMMENTS_SETTINGS), key = {};
	await expect(service.add(key, 'a.md', { anchor: createAnchor('alpha', 0, 5), text: 'one' })).rejects.toThrow('EIO');
	fail = false; await service.add(key, 'a.md', { anchor: createAnchor('alpha', 0, 5), text: 'updated during retry' }); expect(store.threadsFor('a.md')).toHaveLength(1);
	expect(store.threadsFor('a.md')[0]!.messages[0]!.text).toBe('updated during retry');
	const replyKey = {}; fail = true;
	await expect(service.reply(replyKey, store.threadsFor('a.md')[0]!.id, 'reply')).rejects.toThrow('EIO');
	fail = false; await service.reply(replyKey, store.threadsFor('a.md')[0]!.id, 'updated reply');
	expect(store.threadsFor('a.md')[0]!.messages.map(message => message.text)).toEqual(['updated during retry', 'updated reply']);
	service.dispose(); await store.close();
});
test('typing into an annotated empty line retains its line thread', async () => {
	const store = new CommentStore(memoryFs(), { timers, debounceMs: 1e6 });
	const thread = await store.add('a.md', { anchor: createAnchor('\nnext', 0, 0), text: 'line' });
	store.applyChanges('a.md', { mapPos: (_pos, assoc) => assoc === 1 ? 5 : 0 }, 'hello\nnext', '\nnext');
	expect(thread).toMatchObject({ status: 'open', anchor: { text: 'hello', start: 0, end: 5 } }); await store.close();
});
test('unindexed legacy sidecar is detected before accepting a draft', async () => {
	const fs = memoryFs(), initial = new CommentStore(fs, { timers, debounceMs: 1e6 });
	await initial.add('a.md', { anchor: createAnchor('alpha', 0, 5), text: 'root' }); await initial.close();
	const path = [...fs.files.keys()].find(path => path.includes('/files/'))!;
	fs.files.delete('.nand/editor/comments/index.json'); const body = JSON.stringify({ version: 1, comments: [] }); fs.files.set(path, body);
	const store = new CommentStore(fs, { timers });
	await expect(store.add('a.md', { anchor: createAnchor('alpha', 0, 5), text: 'new' })).rejects.toThrow('Legacy');
	expect(store.threadsFor('a.md')).toEqual([]); await store.close(); expect(fs.files.get(path)).toBe(body);
});

test('one shared document revision maps once across views, including stale broadcasts and undo', async () => {
	const fs = memoryFs(), store = new CommentStore(fs, { timers, debounceMs: 1e6 });
	const before = 'Alpha start\nalpha TARGET omega\nlast line\n';
	const original = createAnchor(before, before.indexOf('TARGET'), before.indexOf('TARGET') + 6);
	await store.add('a.md', { anchor: original, text: 'shared' }); store.reconcile('a.md', before); await store.flush();
	const first = ChangeSet.of({ from: 0, insert: 'prefix\n' }, before.length), next = 'prefix\n' + before;
	store.applyChanges('a.md', first, next, before); store.applyChanges('a.md', first, next, before);
	const second = ChangeSet.of({ from: 0, insert: 'another\n' }, next.length), latest = 'another\n' + next;
	store.applyChanges('a.md', second, latest, next); store.applyChanges('a.md', first, next, before);
	store.applyChanges('a.md', second, latest, next);
	await store.flush();
	const persisted = () => JSON.parse([...fs.files.entries()].find(([path]) => path.includes('/files/'))![1]).threads[0];
	expect(persisted()).toMatchObject({ status: 'open', anchor: { text: 'TARGET', start: 33, end: 39 } });
	const undo = ChangeSet.of({ from: 0, to: 15 }, latest.length);
	store.applyChanges('a.md', undo, before, latest); store.applyChanges('a.md', undo, before, latest);
	await store.flush(); expect(persisted()).toMatchObject({ status: 'open', anchor: original });
	await store.close();
});

for (const [name, document, threshold, quote] of [
	['insert', 'abXXcdefghijZ', 0.2, 'abXXcdefghij'],
	['delete', 'abefghijXYZ', 0.2, 'abefghij'],
	['replace', 'abXYefghijZ', 0.2, 'abXYefghij'],
	['ceil threshold', 'abXYefghijZ', 0.11, 'abXYefghij'],
	['outside threshold', 'abXYefghijZ', 0.1, null],
] as const) test(`fuzzy ${name} locates and persists the complete optimum range`, async () => {
	const anchor = createAnchor('abcdefghij', 0, 10);
	expect(locateAnchor(document, anchor, threshold)).toEqual(quote ? { start: 0, end: quote.length } : null);
	const fs = memoryFs(), store = new CommentStore(fs, { timers, debounceMs: 1e6, fuzzyThreshold: () => threshold });
	await store.add('a.md', { anchor, text: 'fuzzy' }); store.reconcile('a.md', document); await store.close();
	const thread = JSON.parse([...fs.files.entries()].find(([path]) => path.includes('/files/'))![1]).threads[0];
	expect(thread).toMatchObject(quote ? { status: 'open', anchor: { text: quote, start: 0, end: quote.length } } : { status: 'orphaned', anchor });
});
