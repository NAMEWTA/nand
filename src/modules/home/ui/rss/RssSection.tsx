// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/rss-section.ts, src/rss-article-modal.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from 'zustand';
import { Rss, RefreshCw, Settings, CheckCheck, Download, FileText, ExternalLink, X } from 'lucide-react';
import { Component, MarkdownRenderer } from 'obsidian';
import { toast } from 'sonner';
import type { BoardStore } from '../../services/board-store';
import type { DashboardColumn, RssConfig } from '../../core/board/types';
import type { RssItem } from '../../core/rss/rss-xml';
import { feedKey, refreshFeeds, resolveArticleMarkdown, type ResolvedArticle } from '../../platform/rss/rss-service';
import { getRssStore } from '../../platform/rss/rss-store';
import { saveRssArticle } from '../../platform/rss/rss-note';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
import { useVisible, useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import { IconButton, Choice } from '../board/controls';
import { p2Classes as c } from '../theme/p2-classes';
import { P2Dialog } from '../dialogs/P2Dialog';
import { RssFilter } from './RssFilter';
import { RssConfigDialog } from './RssConfigDialog';
interface Row {
	feedUrl: string;
	feedTitle: string;
	feedGroup: string;
	item: RssItem;
}
export function rssGroupNames(config: RssConfig): string[] {
	return [
		...new Set(
			[...(config.groups ?? []), ...config.feeds.map((f) => f.group ?? '')].map((s) => s.trim()).filter(Boolean),
		),
	];
}
export function RssSection({
	store,
	column,
	actions,
}: {
	store: BoardStore;
	column: DashboardColumn;
	actions?: HTMLElement | null;
}) {
	const t = useT(),
		visible = useVisible(),
		doc = useOwnerDocument(),
		settings = useStore(store.state, (s) => s.settings),
		rss = useMemo(() => getRssStore(store.host.app), [store]),
		config = useMemo(() => column.rssConfig ?? { feeds: [], downloadFolder: '' }, [column.rssConfig]);
	const [, redraw] = useState(0),
		[editing, setEditing] = useState(false),
		[filter, setFilter] = useState('all'),
		[page, setPage] = useState(1),
		[busy, setBusy] = useState(false),
		[error, setError] = useState(''),
		[reader, setReader] = useState<Row | null>(null),
		[refresh, setRefresh] = useState(0);
	const pending = useRef(new Set<string>()),
		lifetime = useRef<AbortController | null>(null),
		requests = useRef(new Map<string, Promise<ResolvedArticle>>());
	useEffect(() => rss.subscribe(() => redraw((n) => n + 1)), [rss]);
	useEffect(() => {
		rss.setRetention(settings.rssReadRetentionDays);
	}, [rss, settings.rssReadRetentionDays]);
	useEffect(() => {
		if (!visible) return;
		let active = true;
		const controller = new AbortController();
		const inFlight = requests.current;
		lifetime.current = controller;
		setBusy(true);
		setError('');
		void rss
			.load()
			.then(() =>
				refreshFeeds(rss, config.feeds, {
					force: refresh > 0,
					signal: controller.signal,
					ownerWindow: doc.defaultView ?? undefined,
				}),
			)
			.catch((e) => {
				if (active) setError(String(e));
			})
			.finally(() => {
				if (active) {
					setBusy(false);
					redraw((n) => n + 1);
				}
			});
		return () => {
			active = false;
			controller.abort();
			inFlight.clear();
		};
	}, [rss, config, refresh, visible, doc]);
	const patch = async (value: RssConfig) => {
		await store.edit((data) => {
			const col = data.columns.find((x) => (x.id ?? x.name) === (column.id ?? column.name));
			if (col) col.rssConfig = value;
		});
	};
	const rows = config.feeds
		.flatMap((source) => {
			const key = feedKey(source.url),
				entry = rss.feedEntry(key);
			return (entry?.items ?? []).map((item) => ({
				feedUrl: key,
				feedTitle: source.name?.trim() || entry?.title || source.url,
				feedGroup: source.group?.trim() ?? '',
				item,
			}));
		})
		.sort((a, b) => (b.item.pubDate ?? 0) - (a.item.pubDate ?? 0));
	const unread = rows.filter((r) => !rss.isRead(r.item.guid)).length;
	const options = [
		{ value: 'all', label: `${t('rss.all')} (${rows.length})` },
		{ value: 'unread', label: `${t('rss.unreadOnly')} (${unread})` },
		...(config.groupBy === 'none'
			? []
			: config.groupBy === 'feed'
				? config.feeds.map((f) => ({
						value: `feed:${feedKey(f.url)}`,
						label: `${f.name || f.url} (${rows.filter((r) => r.feedUrl === feedKey(f.url)).length})`,
					}))
				: rssGroupNames(config).map((g) => ({
						value: `group:${g}`,
						label: `${g} (${rows.filter((r) => r.feedGroup === g).length})`,
					}))),
	];
	const filtered = rows.filter((r) =>
			filter === 'unread'
				? !rss.isRead(r.item.guid)
				: filter.startsWith('feed:')
					? r.feedUrl === filter.slice(5)
					: filter.startsWith('group:')
						? r.feedGroup === filter.slice(6)
						: true,
		),
		size = config.pageSize ?? 20,
		pages = Math.max(1, Math.ceil(filtered.length / size)),
		current = Math.min(page, pages);
	const resolve = useCallback(
		(row: Row) => {
			let promise = requests.current.get(row.item.guid);
			if (!promise) {
				promise = resolveArticleMarkdown(
					rss,
					{ title: row.feedTitle, link: rss.feedEntry(row.feedUrl)?.link ?? '' },
					row.item,
					{ signal: lifetime.current?.signal, ownerWindow: doc.defaultView ?? undefined },
				);
				requests.current.set(row.item.guid, promise);
			}
			return promise;
		},
		[rss, doc],
	);
	const save = async (row: Row) => {
		if (pending.current.has(row.item.guid)) return;
		pending.current.add(row.item.guid);
		redraw((n) => n + 1);
		try {
			const existing = rss.savedPath(row.item.guid);
			if (existing && contentFiles(store.host.app).getFileByPath(existing)) {
				await store.openFile(existing);
				return;
			}
			if (existing) rss.clearSaved(row.item.guid);
			const result = await resolve(row);
			if (!result.markdown) throw new Error(t('rss.saveFailed'));
			const file = await saveRssArticle(store.host.app, {
				folder: config.downloadFolder,
				feedTitle: row.feedTitle,
				item: row.item,
				markdown: result.markdown,
			});
			rss.setSaved(row.item.guid, file.path);
			await rss.flush();
			toast(t('rss.savedNotice', { name: file.basename }));
		} catch (e) {
			setError(String(e));
		} finally {
			pending.current.delete(row.item.guid);
			redraw((n) => n + 1);
		}
	};
	if (!visible) return null;
	return (
		<div className={c('dashboard-rss-content')}>
			{actions &&
				createPortal(
					<>
						<IconButton
							label={t('rss.refresh')}
							onClick={() => {
								requests.current.clear();
								setRefresh((n) => n + 1);
							}}
						>
							<RefreshCw />
						</IconButton>
						<IconButton label={t('rss.configure')} onClick={() => setEditing(true)}>
							<Settings />
						</IconButton>
					</>,
					actions,
				)}
			{error && (
				<p role="alert" className="text-destructive">
					{error}
				</p>
			)}
			{rss.saveState.error && (
				<Button variant="outline" onClick={() => rss.retry()}>
					{t('common.retry')}: {rss.saveState.error}
				</Button>
			)}
			{!config.feeds.length ? (
				<div className={c('dashboard-rss-empty-config')}>
					<Rss className={c('dashboard-rss-empty-config-icon')} />
					<div className={c('dashboard-rss-empty-config-text')}>{t('rss.noFeeds')}</div>
					<div className={c('dashboard-rss-empty-config-hint')}>{t('rss.configureHint')}</div>
					<Button
						className={c('dashboard-modal-btn dashboard-modal-btn--confirm')}
						onClick={() => setEditing(true)}
					>
						{t('rss.configure')}
					</Button>
				</div>
			) : (
				<>
					<div className={c('dashboard-rss-toolbar')}>
						<RssFilter
							value={filter}
							options={options}
							onChange={(key) => {
								setFilter(key);
								setPage(1);
							}}
						/>
						{unread > 0 && filter !== 'unread' && (
							<span className={c('dashboard-rss-count')}>{t('rss.unreadCount', { count: unread })}</span>
						)}
						<IconButton
							className={c('dashboard-rss-markread')}
							label={t('rss.markAllRead')}
							onClick={() => rss.markAllRead(filtered.map((r) => r.item.guid))}
						>
							<CheckCheck />
						</IconButton>
						{busy && <span className={c('dashboard-rss-refreshing')}>{t('rss.loading')}</span>}
						<div className="flex-1" />
						<Choice
							compact
							className={c('dashboard-library-page-size')}
							label={t('rss.pageSize')}
							value={String(size)}
							options={[10, 20, 50, 100].map((n) => ({
								value: String(n),
								label: t('library.pageSize', { count: n }),
							}))}
							onChange={(value) => {
								setPage(1);
								void patch({ ...config, pageSize: +value }).catch((e) => setError(String(e)));
							}}
						/>
					</div>
					<div className={c('dashboard-rss-list')}>
						{!filtered.length && (
							<div className={c('dashboard-rss-empty')}>{t(busy ? 'rss.loading' : 'rss.noItems')}</div>
						)}
						{filtered.slice((current - 1) * size, current * size).map((row) => (
							<div
								key={`${row.feedUrl}:${row.item.guid}`}
								data-guid={row.item.guid}
								className={c(`dashboard-rss-item${rss.isRead(row.item.guid) ? ' is-read' : ''}`)}
							>
								<div className={c('dashboard-rss-dot')} />
								<Button
									variant="ghost"
									className={c(
										'dashboard-rss-item-main h-auto items-stretch justify-start rounded-none p-0 text-start whitespace-normal',
									)}
									onClick={() => {
										rss.markRead(row.item.guid);
										setReader(row);
									}}
								>
									<span className="flex min-w-0 flex-1 flex-col gap-[3px]">
										<span className={c('dashboard-rss-item-title block')}>{row.item.title}</span>
										<span className={c('dashboard-rss-item-meta')}>
											{row.item.pubDate && (
												<span className={c('dashboard-rss-item-date')}>
													{new Date(row.item.pubDate).toLocaleDateString('sv')}
												</span>
											)}
											<span className={c('dashboard-rss-item-feed')}>{row.feedTitle}</span>
										</span>
									</span>
								</Button>
								<IconButton
									disabled={pending.current.has(row.item.guid)}
									className={c('dashboard-rss-item-save')}
									label={t(rss.savedPath(row.item.guid) ? 'rss.openNote' : 'rss.download')}
									onClick={() => void save(row)}
								>
									{rss.savedPath(row.item.guid) ? <FileText /> : <Download />}
								</IconButton>
							</div>
						))}
					</div>
					{pages > 1 && (
						<div className={c('dashboard-library-pagination')}>
							<Button
								variant="ghost"
								disabled={current === 1}
								aria-label={t('home.p2.prev')}
								onClick={() => setPage(current - 1)}
							>
								‹
							</Button>
							<span>
								{current} / {pages}
							</span>
							<Button
								variant="ghost"
								disabled={current === pages}
								aria-label={t('home.p2.next')}
								onClick={() => setPage(current + 1)}
							>
								›
							</Button>
						</div>
					)}
				</>
			)}
			{editing && (
				<RssConfigDialog
					store={store}
					config={config}
					rss={rss}
					onClose={() => setEditing(false)}
					onSave={patch}
				/>
			)}
			{reader && (
				<ArticleReader
					store={store}
					row={reader}
					resolve={resolve}
					onSave={() => save(reader)}
					saved={!!rss.savedPath(reader.item.guid)}
					busy={pending.current.has(reader.item.guid)}
					onClose={() => setReader(null)}
				/>
			)}
		</div>
	);
}
function ArticleReader({
	store,
	row,
	resolve,
	onSave,
	saved,
	busy,
	onClose,
}: {
	store: BoardStore;
	row: Row;
	resolve: (row: Row) => Promise<ResolvedArticle>;
	onSave: () => Promise<void>;
	saved: boolean;
	busy: boolean;
	onClose: () => void;
}) {
	const t = useT(),
		[markdown, setMarkdown] = useState<string | null | undefined>(),
		ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		let active = true;
		void resolve(row)
			.then((result) => {
				if (active) setMarkdown(result.markdown);
			})
			.catch(() => {
				if (active) setMarkdown(null);
			});
		return () => {
			active = false;
		};
	}, [resolve, row]);
	useEffect(() => {
		const el = ref.current;
		if (!el || !markdown) return;
		const owner = new Component();
		owner.load();
		void MarkdownRenderer.render(store.host.app, markdown, el, '', owner);
		return () => {
			owner.unload();
			el.replaceChildren();
		};
	}, [store, markdown]);
	return (
		<P2Dialog raw title={row.item.title} width={860} classes="dashboard-rss-reader-wrap" onClose={onClose}>
			<div className={c('dashboard-rss-reader-header')}>
				<div className={c('dashboard-rss-reader-headmain')}>
					<div className={c('dashboard-rss-reader-title')}>{row.item.title}</div>
					<div className={c('dashboard-rss-reader-meta')}>
						<span className={c('dashboard-rss-reader-feed')}>{row.feedTitle}</span>
						{row.item.author && <span>{row.item.author}</span>}
						{row.item.pubDate && (
							<span>{new Date(row.item.pubDate).toLocaleString('sv').slice(0, 16)}</span>
						)}
					</div>
				</div>
				<div className={c('dashboard-rss-reader-actions')}>
					<Button
						disabled={busy}
						className={c(`dashboard-rss-reader-save${saved ? ' is-saved' : ''}`)}
						onClick={() => void onSave()}
					>
						{saved ? <FileText /> : <Download />}
						{t(saved ? 'rss.openNote' : 'rss.saveToVault')}
					</Button>
					<IconButton
						className={c('dashboard-rss-reader-btn')}
						label={t('rss.openInBrowser')}
						onClick={() => {
							void store.host.openBrowser({ url: row.item.link });
						}}
					>
						<ExternalLink />
					</IconButton>
					<IconButton className={c('dashboard-rss-reader-btn')} label={t('common.close')} onClick={onClose}>
						<X />
					</IconButton>
				</div>
			</div>
			<div className={c('dashboard-rss-reader-body')}>
				<div ref={ref} className="nand-native" />
				{markdown === undefined ? t('rss.fetchingArticle') : !markdown ? t('rss.articleFailed') : null}
			</div>
		</P2Dialog>
	);
}
