import { createStore } from 'zustand/vanilla';
import { JsonStore } from '../../../shared/json-store';
import type { TextStorage } from '../../../shared/storage/ports';
import { emptyWorkspace, type WorkspaceState } from '../core/workspace/model';
import { normalizeWorkspace } from '../core/workspace/ops';

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;
export function createWorkspaceStore(
	adapter: TextStorage,
	device: string,
	clock: Pick<Window, 'setTimeout' | 'clearTimeout'>,
	report: (error: unknown) => void,
) {
	const store = createStore<WorkspaceState>(() => emptyWorkspace());
	const disk = new JsonStore<WorkspaceState>(
		adapter,
		`.nand/terminal-agent/${device}/workspace.json`,
		(v): v is WorkspaceState => !!v && typeof v === 'object' && (v as { version?: unknown }).version === 1,
	);
	let timer: number | undefined,
		disposed = false,
		loaded = false,
		dirty = false;
	let baseline = emptyWorkspace(),
		pending = Promise.resolve();
	const flush = (): Promise<void> => {
		if (timer !== undefined) clock.clearTimeout(timer);
		timer = undefined;
		pending = pending.then(async () => {
			if (!loaded || !dirty) return;
			dirty = false;
			const snapshot = store.getState();
			try {
				const merged = await disk.commit({ base: baseline, value: snapshot });
				baseline = merged;
				// Reconcile external changes only when no newer local edit would be lost.
				if (store.getState() === snapshot && JSON.stringify(merged) !== JSON.stringify(snapshot))
					store.setState(merged, true);
			} catch (error) {
				dirty = true;
				report(error);
			}
		});
		return pending;
	};
	const ready = disk
		.load(emptyWorkspace())
		.then((value) => {
			baseline = value;
			if (disposed) return;
			store.setState(normalizeWorkspace(value), true);
			loaded = true;
		})
		.catch(report);
	const unsubscribe = store.subscribe(() => {
		if (!loaded || disposed) return;
		dirty = true;
		if (timer !== undefined) clock.clearTimeout(timer);
		timer = clock.setTimeout(() => {
			timer = undefined;
			void flush();
		}, 500);
	});
	return {
		store,
		ready,
		flush,
		async dispose() {
			disposed = true;
			unsubscribe();
			await ready;
			await flush();
		},
	};
}
