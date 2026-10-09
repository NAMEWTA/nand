import { Notice, type App } from 'obsidian';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { WereadConfig, WereadWidget } from '../../core/board/types';
import { filterWereadBooks, groupWereadBooks, mergeNotebookStats } from '../../core/weread/weread-shelf-model';
import {
	normalizedWidgets,
	type WereadBookLike,
	type WereadBookmarkLike,
	type WereadNotebookLike,
} from '../../core/weread/widget-model';
import {
	getWereadProgressStore,
	type WereadProgressStore,
} from '../../platform/weread/weread-progress-store';
import {
	sharedWereadClient,
	wereadErrorMessage,
	type WereadClient,
} from '../../platform/weread/weread-service';
import { enrichProgress, importHighlightsToObsidian } from '../../platform/weread/widget-data';
import { t } from '../../../../shared/i18n';
import { Icon } from '../../../../ui/primitives/Icon';
import { computeShelfCapacity, contentTypeLabel, groupIcon, groupLabel, readingStateLabel } from './shelf-presentation';
import { WereadHint, WereadStats } from './WereadStats';
export function WereadPanel({
	app,
	apiKey,
	importPath,
	config,
	onReloadReady,
}: {
	app: App;
	apiKey: string;
	importPath: string;
	config?: WereadConfig;
	onReloadReady?: (reload: () => void) => void;
}) {
	const client = useMemo(() => sharedWereadClient(apiKey), [apiKey]),
		store = useMemo(() => getWereadProgressStore(app), [app]),
		[revision, setRevision] = useState(0);
	useLayoutEffect(() => {
		let active = true;
		onReloadReady?.(() => {
			if (active) {
				client.clearCache();
				setRevision((n) => n + 1);
			}
		});
		return () => {
			active = false;
		};
	}, [client, onReloadReady]);
	if (!client.isConfigured()) return <WereadHint title={t('weread.noKey')} description={t('weread.noKeyHint')} />;
	return (
		<>
			{normalizedWidgets(config).map((widget) => (
				<div key={widget.id} class="dashboard-weread-widget">
					{widget.title && <div class="dashboard-weread-widget-title">{widget.title}</div>}
					<div class="dashboard-weread-content">
						{widget.view === 'stats' ? (
							<WereadStats client={client} store={store} widget={widget} revision={revision} />
						) : (
							<BooksWidget
								client={client}
								store={store}
								widget={widget}
								revision={revision}
								app={app}
								importPath={importPath}
							/>
						)}
					</div>
				</div>
			))}
		</>
	);
}
function BooksWidget({
	client,
	store,
	widget,
	revision,
	app,
	importPath,
}: {
	client: WereadClient;
	store: WereadProgressStore;
	widget: WereadWidget;
	revision: number;
	app: App;
	importPath: string;
}) {
	const [books, setBooks] = useState<WereadBookLike[]>([]),
		[notes, setNotes] = useState<WereadNotebookLike[]>([]),
		[status, setStatus] = useState('loading'),
		[error, setError] = useState('');
	useLayoutEffect(() => {
		let active = true;
		setStatus('loading');
		setError('');
		void (async () => {
			try {
				if (widget.view === 'notes') {
					const items = await client.fetchNotebooks();
					if (active) setNotes(items);
				} else {
					let items = await client.fetchShelf();
					if (widget.noteFilters?.length || widget.groupBy === 'notes')
						items = mergeNotebookStats(items, await client.fetchNotebooks());
					if (active) setStatus('loadingProgress');
					items = await enrichProgress(client, store, items, revision > 0);
					if (active)
						setBooks(
							filterWereadBooks(items, {
								progress: widget.progressFilters,
								contentTypes: widget.contentTypeFilters,
								recency: widget.recencyFilters,
								notes: widget.noteFilters,
							}),
						);
				}
				if (active) setStatus('ready');
			} catch (error) {
				if (active) {
					setError(wereadErrorMessage(error));
					setStatus('error');
				}
			}
		})();
		return () => {
			active = false;
		};
	}, [client, store, widget, revision]);
	if (status === 'error') return <WereadHint title={t('weread.loadFailed')} description={error} />;
	if (status !== 'ready') return <WereadHint title={t(`weread.${status}`)} />;
	return widget.view === 'notes' ? (
		<Notebooks notebooks={notes} client={client} app={app} importPath={importPath} />
	) : (
		<Shelf books={books} widget={widget} />
	);
}
function Pager({ page, pages, change }: { page: number; pages: number; change: (page: number) => void }) {
	return pages <= 1 ? null : (
		<div class="dashboard-weread-pager">
			<button class="dashboard-weread-pager-btn" disabled={page <= 1} onClick={() => change(page - 1)}>
				<span>‹</span>
			</button>
			<span class="dashboard-weread-pager-info">
				{page} / {pages}
			</span>
			<button class="dashboard-weread-pager-btn" disabled={page >= pages} onClick={() => change(page + 1)}>
				<span>›</span>
			</button>
		</div>
	);
}
function Shelf({ books, widget }: { books: WereadBookLike[]; widget: WereadWidget }) {
	const [page, setPage] = useState(1),
		[capacity, setCapacity] = useState(12),
		root = useRef<HTMLDivElement>(null),
		groupBy = widget.groupBy ?? 'readingState';
	useLayoutEffect(() => {
		const el = root.current;
		if (!el) return;
		const resize = () => setCapacity(computeShelfCapacity(el));
		resize();
		const Observer = el.ownerDocument.defaultView?.ResizeObserver;
		if (!Observer) return;
		const observer = new Observer(resize);
		observer.observe(el.closest('.dashboard-section-row') ?? el);
		return () => observer.disconnect();
	}, []);
	const ordered = groupWereadBooks(books, groupBy).flatMap((g) => g.books),
		pages = Math.max(1, Math.ceil(ordered.length / capacity)),
		current = Math.min(page, pages),
		slice = ordered.slice((current - 1) * capacity, current * capacity);
	const grid = (items: WereadBookLike[]) => (
		<div class="dashboard-weread-grid">
			{items.map((book) => (
				<div key={book.bookId} class="dashboard-weread-book">
					<div
						class={`dashboard-weread-book-cover${book.cover ? '' : ' dashboard-weread-book-cover--placeholder'}`}
						style={book.cover ? { backgroundImage: `url(${JSON.stringify(book.cover)})` } : undefined}
					/>
					<div class="dashboard-weread-book-info">
						<div class="dashboard-weread-book-title">{book.title}</div>
						<div class="dashboard-weread-book-author">{book.author}</div>
						<div class="dashboard-weread-book-meta">
							<div class="dashboard-weread-book-kind">{contentTypeLabel(book.contentType)}</div>
							{(book.noteCount ?? 0) + (book.reviewCount ?? 0) > 0 && (
								<div class="dashboard-weread-book-notes">
									{t('weread.noteBadge', {
										count: String((book.noteCount ?? 0) + (book.reviewCount ?? 0)),
									})}
								</div>
							)}
						</div>
						<div class="dashboard-weread-progress">
							<div class="dashboard-weread-progress-fill" style={{ width: `${book.progress}%` }} />
						</div>
						<div class="dashboard-weread-progress-meta">
							<div class="dashboard-weread-book-state">{readingStateLabel(book.readingState)}</div>
							<div class="dashboard-weread-book-pct">{book.progress}%</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
	return (
		<div ref={root}>
			{!books.length ? (
				<WereadHint title={t('weread.empty')} description={t('weread.emptyHint')} />
			) : (
				<>
					{groupBy === 'none' ? (
						grid(slice)
					) : (
						<div class="dashboard-weread-groups">
							{groupWereadBooks(slice, groupBy).map((group) => (
								<div
									key={group.key}
									class={`dashboard-weread-group dashboard-weread-group--${group.key}`}
								>
									<div class="dashboard-weread-group-head">
										<Icon className="dashboard-weread-group-icon" name={groupIcon(group.key)} />
										<div class="dashboard-weread-group-name">{groupLabel(group.key)}</div>
										<div class="dashboard-weread-group-count">{group.books.length}</div>
									</div>
									{grid(group.books)}
								</div>
							))}
						</div>
					)}
					<Pager page={current} pages={pages} change={setPage} />
				</>
			)}
		</div>
	);
}
function Notebooks({
	notebooks,
	client,
	app,
	importPath,
}: {
	notebooks: WereadNotebookLike[];
	client: WereadClient;
	app: App;
	importPath: string;
}) {
	const [page, setPage] = useState(1),
		pages = Math.max(1, Math.ceil(notebooks.length / 10)),
		current = Math.min(page, pages);
	return !notebooks.length ? (
		<WereadHint title={t('weread.noNotes')} />
	) : (
		<>
			<div class="dashboard-weread-notebooks">
				{notebooks.slice((current - 1) * 10, current * 10).map((note) => (
					<Notebook key={note.bookId} note={note} client={client} app={app} importPath={importPath} />
				))}
			</div>
			<Pager page={current} pages={pages} change={setPage} />
		</>
	);
}
function Notebook({
	note,
	client,
	app,
	importPath,
}: {
	note: WereadNotebookLike;
	client: WereadClient;
	app: App;
	importPath: string;
}) {
	const [marks, setMarks] = useState<WereadBookmarkLike[] | null>(null),
		[open, setOpen] = useState(false),
		[loading, setLoading] = useState(false),
		[importing, setImporting] = useState(false),
		pending = useRef(false),
		alive = useRef(true),
		fetching = useRef(false);
	useLayoutEffect(
		() => () => {
			alive.current = false;
		},
		[],
	);
	const toggle = async () => {
		if (marks) {
			setOpen(!open);
			return;
		}
		if (fetching.current) return;
		fetching.current = true;
		setLoading(true);
		try {
			const value = await client.fetchBookmarks(note.bookId);
			if (alive.current) {
				setMarks(value);
				setOpen(true);
			}
		} catch {
			if (alive.current) new Notice(t('weread.loadFailed'));
		} finally {
			fetching.current = false;
			if (alive.current) setLoading(false);
		}
	};
	const importNotes = async () => {
		if (pending.current) return;
		pending.current = true;
		setImporting(true);
		try {
			const items = await client.fetchBookmarks(note.bookId);
			if (!items.length) {
				new Notice(t('weread.noHighlights'));
				return;
			}
			const path = await importHighlightsToObsidian(app, importPath, note, items);
			new Notice(t('weread.importDone', { n: String(items.length), name: note.title, path }));
		} catch {
			new Notice(t('weread.importFailed'));
		} finally {
			pending.current = false;
			if (alive.current) setImporting(false);
		}
	};
	return (
		<div class="dashboard-weread-notebook">
			<div class="dashboard-weread-notebook-head" onClick={() => void toggle()}>
				<div class="dashboard-weread-notebook-meta">
					<div class="dashboard-weread-book-title">{note.title}</div>
					<div class="dashboard-weread-notebook-count">
						{t('weread.noteCount', { n: String(note.noteCount) })}
					</div>
				</div>
				<button
					class="dashboard-weread-notebook-import"
					disabled={importing}
					aria-label={t('weread.importHighlights')}
					title={t('weread.importHighlights')}
					onClick={(e) => {
						e.stopPropagation();
						void importNotes();
					}}
				>
					<Icon name="file-down" />
				</button>
				<Icon
					className="dashboard-weread-notebook-chevron"
					name={loading ? 'loader' : open ? 'chevron-down' : 'chevron-right'}
				/>
			</div>
			<div class={`dashboard-weread-notebook-detail${open ? ' dashboard-weread-notebook-detail--open' : ''}`}>
				{marks?.length
					? marks.map((mark, i) => (
							<div key={i} class="dashboard-weread-highlight">
								{mark.markText}
							</div>
						))
					: marks && <div class="dashboard-weread-hint-desc">{t('weread.noHighlights')}</div>}
			</div>
		</div>
	);
}
