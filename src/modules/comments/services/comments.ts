import { createStore } from 'zustand/vanilla';
import type { CommentedNote } from '../api';
import type { CommentStore } from '../core/store';
import type { CommentMessage, CommentThread, NewCommentInput } from '../core/model';
import type { CommentsSettings } from '../settings';

/** UI snapshots and write actions. The durable queue remains owned by CommentStore. */
export function createCommentsService(store: CommentStore, settings: () => CommentsSettings) {
	const state = createStore(() => ({ revision: 0, path: null as string | null, notes: [] as CommentedNote[], error: false }));
	let dead = false;
	let generation = 0;
	const refresh = async () => {
		const current = ++generation;
		try {
			const notes = await store.listFiles();
			if (!dead && current === generation) state.setState(s => ({ notes, error: false, revision: s.revision + 1 }));
		} catch { if (!dead) state.setState({ error: true }); }
	};
	const off = store.subscribe(() => { state.setState(s => ({ revision: s.revision + 1 })); void refresh(); });
	// A retry after flush failure must not append the same draft again.
	const accepted = new WeakMap<object, { id: string; messageId: string; text: string; author: string }>();
	const persistOnce = async (key: object, text: string, operation: () => Promise<CommentThread>) => {
		let draft = accepted.get(key);
		if (!draft) {
			const thread = await operation(), message = thread.messages[thread.messages.length - 1]!;
			draft = { id: thread.id, messageId: message.id, text, author: message.author };
			accepted.set(key, draft);
		} else if (draft.text !== text) {
			await store.editMessage(draft.id, draft.messageId, text, draft.author);
			draft.text = text;
		}
		await store.flush();
		accepted.delete(key);
	};
	return {
		state, store, settings, refresh,
		setPath(path: string | null) { state.setState({ path }); },
		async load(path: string) { await store.loadFile(path); if (!dead) state.setState(s => ({ revision: s.revision + 1, error: false })); },
		add(key: object, path: string, input: NewCommentInput) { return persistOnce(key, input.text, () => store.add(path, { ...input, author: settings().author })); },
		reply(key: object, id: string, text: string) { return persistOnce(key, text, () => store.reply(id, text, settings().author)); },
		async edit(id: string, messageId: string, text: string) { await store.editMessage(id, messageId, text, settings().author); await store.flush(); },
		async status(id: string, resolved: boolean) { await (resolved ? store.resolve(id) : store.reopen(id)); await store.flush(); },
		async remove(id: string) { await store.remove(id); await store.flush(); },
		async removeReply(id: string, messageId: string) { const message = await store.removeReply(id, messageId); await store.flush(); return message; },
		async restoreReply(id: string, message: CommentMessage) { await store.restoreReply(id, message); await store.flush(); },
		async reanchor(id: string, anchor: NewCommentInput['anchor']) { await store.reanchor(id, anchor); await store.flush(); },
		async resolveAll(path: string) { await store.loadFile(path); for (const thread of store.threadsFor(path)) if (thread.status === 'open') await store.resolve(thread.id); await store.flush(); },
		dispose() { dead = true; off(); },
	};
}
export type CommentsService = ReturnType<typeof createCommentsService>;
