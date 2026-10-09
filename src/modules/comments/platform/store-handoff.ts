import type { CommentStore } from '../core/store';

// App survives plugin bundle reloads. Separate Apps never share pending writes.
const KEY = Symbol.for('nand.editor.comment-store-handoff');
interface HandoffState {
	owner: object | null;
	pending: Set<CommentStore>;
}

export function beginCommentStoreActivation(app: object) {
	const host = app as { [KEY]?: HandoffState };
	const state = host[KEY] ?? (host[KEY] = { owner: null, pending: new Set() });
	const owner = {};
	state.owner = owner;
	const drain = async (store: CommentStore) => {
		await store.close();
		state.pending.delete(store);
	};
	return {
		isCurrent: () => state.owner === owner,
		async ready(): Promise<void> {
			for (const store of state.pending) await drain(store);
		},
		cancel(): void {
			if (state.owner === owner) state.owner = null;
		},
		retire(store: CommentStore): void {
			state.pending.add(store);
			// Sealing happens inside close before its first await. Keep failed stores
			// reachable, including failures before a journal could be written.
			void drain(store).catch(() => undefined);
		},
	};
}
