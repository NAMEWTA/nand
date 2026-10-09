import { Notice, TFile } from 'obsidian';
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { getLanguage, t } from '../../../../shared/i18n/index';
import { Button } from '../../../../ui/primitives/Button';
import { EmptyState } from '../../../../ui/primitives/EmptyState';
import { getAgent } from '../../core/launch/catalog';
import type { AgentId } from '../../core/launch/types';
import type { HistoryPage, NativeSession, NativeSessionSummary, NativeUsage } from '../../platform/desktop/server/agent-data-client';
import type { AgentController } from '../../services/controller';
import { promptText } from './confirm';

const PAGE = 100;
type Filter = 'all' | 'favorite' | 'archived';

const when = (ms: number): string => new Date(ms).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US');
const agentTitle = (id: string): string => {
	try {
		return getAgent(id as AgentId).title;
	} catch {
		return id;
	}
};
const count = (value: number): string => value.toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US');

export function UsageLine({ usage }: { usage: NativeUsage }) {
	if (!usage.known) return <span class="nand-agent-usage-line">{t('agent.usageUnknown')}</span>;
	return (
		<span class="nand-agent-usage-line">
			{t('agent.tokens')}: {count(usage.input)} / {count(usage.output)} · {t('agent.cache')}: {count(usage.cacheRead)} / {count(usage.cacheWrite)} ·{' '}
			{usage.cost === null ? t('agent.costUnknown') : `$${usage.cost.toFixed(2)}`}
			{usage.partial ? ` · ${t('agent.usagePartial')}` : ''}
		</span>
	);
}

function displayTitle(controller: AgentController, row: NativeSessionSummary): string {
	return controller.history().meta(row.key).title || row.title || agentTitle(row.agentId);
}

function relativeCwd(controller: AgentController, cwd: string): string {
	const vault = controller.vaultPath();
	if (!vault || !cwd.startsWith(vault)) return cwd;
	return cwd.slice(vault.length).replace(/^[\\/]/, '') || '/';
}

function HistoryList({ controller, select }: { controller: AgentController; select: (key: string) => void }) {
	const [query, setQuery] = useState('');
	const [filter, setFilter] = useState<Filter>('all');
	const [offset, setOffset] = useState(0);
	const [page, setPage] = useState<HistoryPage | null>(null);
	const [error, setError] = useState('');
	const [warnings, setWarnings] = useState<string[]>([]);
	const [revision, setRevision] = useState(0);
	useEffect(() => controller.history().subscribe(() => setRevision((value) => value + 1)), [controller]);
	useEffect(() => {
		const abort = new AbortController();
		const timer = window.setTimeout(() => {
			const history = controller.history();
			void (history.hasScanned ? Promise.resolve([] as string[]) : history.scan(abort.signal))
				.then((found) => {
					if (found.length) setWarnings(found);
					return history.query(query.trim(), offset, abort.signal, filter);
				})
				.then((next) => {
					setPage(next);
					setError('');
				})
				.catch((reason: unknown) => {
					if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
				});
		}, 200);
		return () => {
			window.clearTimeout(timer);
			abort.abort();
		};
	}, [controller, query, filter, offset, revision]);
	const refresh = () => {
		setPage(null);
		void controller.history().refresh().then((found) => setWarnings(found), (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
	};
	const total = page?.total ?? 0;
	return (
		<div class="nand-agent-history">
			<div class="nand-agent-history-toolbar">
				<input
					type="search"
					class="nand-agent-history-search"
					placeholder={t('agent.historySearch')}
					aria-label={t('agent.historySearch')}
					value={query}
					onInput={(event) => {
						setQuery(event.currentTarget.value);
						setOffset(0);
					}}
				/>
				<select
					class="dropdown"
					aria-label={t('agent.historyFilter')}
					value={filter}
					onChange={(event) => {
						setFilter(event.currentTarget.value as Filter);
						setOffset(0);
					}}
				>
					<option value="all">{t('agent.filterAll')}</option>
					<option value="favorite">{t('agent.filterFavorite')}</option>
					<option value="archived">{t('agent.filterArchived')}</option>
				</select>
				<Button size="sm" icon="refresh-cw" onClick={refresh}>{t('agent.refresh')}</Button>
			</div>
			{page && <div class="nand-agent-history-usage"><span>{t('agent.vaultUsage')}</span> <UsageLine usage={page.usage} /></div>}
			{warnings.length > 0 && <p class="nand-agent-history-warning">{t('agent.scanIssues')}</p>}
			{error && <p class="nand-agent-history-error">{error}</p>}
			{!page && !error && <p class="nand-agent-history-loading">{t('agent.loading')}</p>}
			{page && !page.rows.length && <EmptyState icon="history" title={query || filter !== 'all' ? t('agent.noHistoryMatches') : t('agent.historyEmpty')} description="" layout="content" />}
			{page && page.rows.length > 0 && (
				<ul class="nand-agent-history-list">
					{page.rows.map((row) => {
						const meta = controller.history().meta(row.key);
						return (
							<li key={row.key}>
								<button type="button" class="nand-agent-history-row" onClick={() => select(row.key)}>
									<span class="nand-agent-history-title">
										{meta.favorite ? '★ ' : ''}
										{displayTitle(controller, row)}
									</span>
									<span class="nand-agent-history-meta">
										{agentTitle(row.agentId)} · {when(row.modifiedAtMs)} · {relativeCwd(controller, row.cwd)}
										{meta.tags?.length ? ` · ${meta.tags.join(', ')}` : ''}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}
			{total > PAGE && (
				<div class="nand-agent-history-pages">
					<Button size="sm" icon="chevron-left" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>{t('agent.previousPage')}</Button>
					<span>{t('agent.historyRange', { start: offset + 1, end: Math.min(total, offset + PAGE), total })}</span>
					<Button size="sm" icon="chevron-right" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>{t('agent.nextPage')}</Button>
				</div>
			)}
		</div>
	);
}

/** Find a summary by key: the panel cache first, then the index pages. */
async function locate(controller: AgentController, key: string, signal: AbortSignal): Promise<NativeSessionSummary | undefined> {
	const cached = controller.findHistory(key);
	if (cached) return cached;
	const history = controller.history();
	if (!history.hasScanned) await history.scan(signal);
	for (let offset = 0; offset < PAGE * 20; offset += PAGE) {
		const page = await history.query('', offset, signal, 'all');
		const row = page.rows.find((item) => item.key === key) ?? (await history.query('', offset, signal, 'archived')).rows.find((item) => item.key === key);
		if (row) return row;
		if (offset + PAGE >= page.total) return undefined;
	}
	return undefined;
}

function HistoryPreview({ controller, historyKey, back }: { controller: AgentController; historyKey: string; back: () => void }) {
	const [row, setRow] = useState<NativeSessionSummary | null | undefined>(undefined);
	const [session, setSession] = useState<NativeSession | null>(null);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const [, setRevision] = useState(0);
	const textRef = useRef<HTMLPreElement>(null);
	useEffect(() => controller.history().subscribe(() => setRevision((value) => value + 1)), [controller]);
	useEffect(() => {
		const abort = new AbortController();
		setRow(undefined);
		setSession(null);
		void locate(controller, historyKey, abort.signal)
			.then(async (found) => {
				setRow(found ?? null);
				if (found) setSession(await controller.history().read(found, abort.signal));
			})
			.catch((reason: unknown) => {
				if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
			});
		return () => abort.abort();
	}, [controller, historyKey]);
	if (row === undefined && !error) return <p class="nand-agent-history-loading">{t('agent.loading')}</p>;
	if (!row) return <EmptyState icon="history" title={error || t('agent.sessionMissing')} description="" layout="content" />;
	const meta = controller.history().meta(row.key);
	const update = (patch: Parameters<ReturnType<AgentController['history']>['update']>[1]) => void controller.history().update(row.key, patch).catch((reason: unknown) => new Notice(reason instanceof Error ? reason.message : String(reason)));
	const resume = () => {
		setBusy(true);
		void controller.resume(row).catch((reason: unknown) => new Notice(reason instanceof Error ? reason.message : String(reason))).finally(() => setBusy(false));
	};
	const rename = async () => {
		const title = await promptText(controller.app, t('agent.historyTitle'), meta.title || row.title);
		if (title === null) return;
		const tags = await promptText(controller.app, t('agent.tags'), (meta.tags ?? []).join(', '));
		update({ title, ...(tags === null ? {} : { tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) }) });
	};
	const exportNote = () => {
		void controller
			.history()
			.export(row)
			.then(async (file: TFile) => {
				new Notice(t('agent.exported', { path: file.path }));
				try {
					await controller.app.workspace.getLeaf('tab').openFile(file);
				} catch (reason) {
					new Notice(t('agent.exportOpenFailed', { path: file.path, message: reason instanceof Error ? reason.message : String(reason) }));
				}
			})
			.catch((reason: unknown) => new Notice(reason instanceof Error ? reason.message : String(reason)));
	};
	return (
		<div class="nand-agent-preview">
			<div class="nand-agent-preview-toolbar">
				<Button size="sm" icon="arrow-left" onClick={back}>{t('agent.history')}</Button>
				<Button size="sm" variant="primary" icon="play" disabled={busy} onClick={resume}>{busy ? t('agent.resuming') : t('agent.resume')}</Button>
				<Button size="sm" icon="pencil" onClick={() => void rename()}>{t('agent.renameTags')}</Button>
				<Button size="sm" icon="star" onClick={() => update({ favorite: !meta.favorite })}>{meta.favorite ? t('agent.unfavorite') : t('agent.favorite')}</Button>
				<Button size="sm" icon="archive" onClick={() => update({ archived: !meta.archived })}>{meta.archived ? t('agent.unarchive') : t('agent.archive')}</Button>
				<Button size="sm" icon="file-down" onClick={exportNote}>{t('agent.export')}</Button>
			</div>
			<h2 class="nand-agent-preview-title">{displayTitle(controller, row)}</h2>
			<p class="nand-agent-preview-meta">
				{agentTitle(row.agentId)} · {when(row.modifiedAtMs)} · {row.cwd}
				{meta.tags?.length ? ` · ${meta.tags.join(', ')}` : ''}
			</p>
			<p class="nand-agent-preview-meta"><UsageLine usage={row.usage} /></p>
			{error && <p class="nand-agent-history-error">{error}</p>}
			<pre ref={textRef} class="nand-agent-preview-text">{session ? session.text : t('agent.loading')}</pre>
		</div>
	);
}

/** History browser (no key) or one conversation's preview (key). */
export function mountHistory(host: HTMLElement, controller: AgentController, key: string, navigate: (key: string) => void): () => void {
	host.addClass('nand-agent-history-host');
	render(key ? <HistoryPreview controller={controller} historyKey={key} back={() => navigate('')} /> : <HistoryList controller={controller} select={navigate} />, host);
	return () => render(null, host);
}
