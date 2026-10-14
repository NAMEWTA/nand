import { createStore } from 'zustand/vanilla';
import { transcriptDetails, type HistoryDetails } from '../core/history/details';
import type { NativeHistory, HistoryMetadata } from '../platform/history/service';
import type { NativeSessionSummary } from '../platform/desktop/server/agent-data-client';
export type HistoryRow = NativeSessionSummary &
	HistoryDetails & { metadata: HistoryMetadata; inVault: boolean; readError?: string };
export class HistoryStore {
	readonly store = createStore<{ rows: HistoryRow[]; loading: boolean; error: string; warnings: string[] }>(() => ({
		rows: [],
		loading: false,
		error: '',
		warnings: [],
	}));
	private pending?: Promise<void>;
	private abort = new AbortController();
	constructor(
		private history: () => NativeHistory,
		readonly vault: () => string,
	) {}
	refresh(scan = true): Promise<void> {
		if (this.abort.signal.aborted) return Promise.resolve();
		if (this.pending) return this.pending;
		this.store.setState({ loading: true });
		this.pending = (async () => {
			try {
				const history = this.history(),
					signal = this.abort.signal;
				const warnings = scan || !history.hasScanned ? await history.scan(signal) : [];
				const rows: NativeSessionSummary[] = [];
				for (let offset = 0; ;) {
					const page = await history.query('', offset, signal, 'all');
					rows.push(...page.rows);
					if (!page.rows.length || rows.length >= page.total) break;
					offset += page.rows.length;
				}
				// The native scope checks canonical directories, including symlink escapes.
				// A lexical prefix check in the UI would misclassify account history.
				const vaultKeys = new Set<string>();
				for (let offset = 0; ;) {
					const page = await history.query('', offset, signal, 'all', 'vault');
					for (const row of page.rows) vaultKeys.add(row.key);
					offset += page.rows.length;
					if (!page.rows.length || offset >= page.total) break;
				}
				const enriched: HistoryRow[] = [];
				const cache = new Map(this.store.getState().rows.map((row) => [row.key, row]));
				// Bounded concurrency, backed by the helper's native index and account checks.
				for (let start = 0; start < rows.length; start += 4) {
					signal.throwIfAborted();
					enriched.push(
						...(await Promise.all(
							rows.slice(start, start + 4).map(async (row) => {
								try {
									const cached = cache.get(row.key);
									if (cached && !cached.readError && cached.modifiedAtMs === row.modifiedAtMs)
										return {
											...cached,
											inVault: vaultKeys.has(row.key),
											metadata: history.meta(row.key),
										};
									const full = await history.read(row, signal);
									return {
										...row,
										inVault: vaultKeys.has(row.key),
										...(await history.details(row, full.text, signal)),
										metadata: history.meta(row.key),
									};
								} catch (error) {
									signal.throwIfAborted();
									return {
										...row,
										inVault: vaultKeys.has(row.key),
										...transcriptDetails(''),
										metadata: history.meta(row.key),
										readError: String(error),
									};
								}
							}),
						)),
					);
				}
				if (!signal.aborted) this.store.setState({ rows: enriched, error: '', warnings });
			} catch (error) {
				if (!this.abort.signal.aborted) this.store.setState({ error: String(error) });
			} finally {
				if (!this.abort.signal.aborted) this.store.setState({ loading: false });
				this.pending = undefined;
			}
		})();
		return this.pending;
	}
	async annotate(key: string, patch: HistoryMetadata) {
		await this.history().update(key, patch);
		this.store.setState((s) => ({
			rows: s.rows.map((row) => (row.key === key ? { ...row, metadata: { ...row.metadata, ...patch } } : row)),
		}));
	}
	dispose() {
		this.abort.abort();
	}
}
