import { expect, test, vi } from 'vitest';
import { HistoryStore } from './history-store';
import type { NativeHistory } from '../platform/history/service';
import type { NativeSessionSummary } from '../platform/desktop/server/agent-data-client';
import { transcriptDetails } from '../core/history/details';

test('history pages, bounds transcript reads, caches metadata and uses canonical native scope', async () => {
	const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: null, known: false };
	const rows: NativeSessionSummary[] = Array.from({ length: 11 }, (_, i) => ({
		key: String(i),
		agentId: 'codex',
		accountKey: '{}',
		sessionId: String(i),
		cwd: '/vault/link',
		title: String(i),
		transcriptPath: String(i),
		modifiedAtMs: 1,
		usage,
	}));
	let active = 0,
		maximum = 0,
		favorite = false;
	const read = vi.fn(async (row: NativeSessionSummary) => {
		maximum = Math.max(maximum, ++active);
		await Promise.resolve();
		active--;
		return { ...row, text: '## user\nFull prompt' };
	});
	const query = vi.fn(async (_q: string, offset: number, _s: AbortSignal, _f: string, scope = 'account') => {
		const result = scope === 'vault' ? rows.slice(0, 1) : rows;
		return { rows: result.slice(offset, offset + 3), total: result.length, usage, revision: 1 };
	});
	const history = {
		hasScanned: true,
		scan: async () => [],
		query,
		read,
		details: async (_r: NativeSessionSummary, text: string) => transcriptDetails(text),
		meta: () => ({ favorite }),
		update: async () => {
			favorite = true;
		},
	} as unknown as NativeHistory;
	const store = new HistoryStore(
		() => history,
		() => '/vault',
	);
	await store.refresh();
	expect(store.store.getState().rows).toHaveLength(11);
	expect(maximum).toBe(4);
	expect(
		store.store
			.getState()
			.rows.filter((r) => r.inVault)
			.map((r) => r.key),
	).toEqual(['0']);
	await store.annotate('0', { favorite: true });
	await store.refresh(false);
	expect(read).toHaveBeenCalledTimes(11);
	expect(store.store.getState().rows[0]?.metadata.favorite).toBe(true);
	store.dispose();
	const count = query.mock.calls.length;
	await store.refresh();
	expect(query.mock.calls).toHaveLength(count);
});

test('disposing during a native read cancels work and does not publish late rows', async () => {
	let entered!: () => void;
	const started = new Promise<void>((resolve) => {
		entered = resolve;
	});
	const history = {
		hasScanned: false,
		scan: (signal: AbortSignal) =>
			new Promise((_resolve, reject) => {
				entered();
				signal.addEventListener('abort', () => reject(signal.reason), { once: true });
			}),
	} as unknown as NativeHistory;
	const store = new HistoryStore(
		() => history,
		() => '/vault',
	);
	const refresh = store.refresh();
	await started;
	store.dispose();
	await refresh;
	expect(store.store.getState().rows).toEqual([]);
	expect(store.store.getState().error).toBe('');
});
