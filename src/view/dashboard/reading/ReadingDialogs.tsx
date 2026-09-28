import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { formatReadingDuration } from '../../../core/reading/duration';
import {
	resolveCoverAsObjectUrl,
	searchBooks,
	type BookSearchResult,
} from '../../../platform/obsidian/reading/book-service';
import type { BookInfo, ReadingService } from '../../../platform/obsidian/reading/reading-service';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import { useService } from '../widgets/use-service';
interface DialogProps {
	service: ReadingService;
	close: () => void;
}
function Header({ title, close, search = false }: { title: string; close: () => void; search?: boolean }) {
	return (
		<div class={search ? 'dashboard-reading-book-header' : 'dashboard-reading-end-header'}>
			<div class={search ? 'dashboard-reading-book-header-title' : 'dashboard-reading-end-title'}>{t(title)}</div>
			<div
				class={search ? 'dashboard-reading-book-close' : 'dashboard-reading-end-close'}
				role="button"
				onClick={close}
			>
				<Icon name="x" />
			</div>
		</div>
	);
}
function Cover({ url, service, className }: { url: string; service: ReadingService; className: string }) {
	const [src, setSrc] = useState('');
	useLayoutEffect(() => {
		let active = true;
		setSrc('');
		if (url)
			void resolveCoverAsObjectUrl(url, service.getApp()).then((value) => {
				if (active) setSrc(value ?? '');
			});
		return () => {
			active = false;
		};
	}, [url, service]);
	return <div class={className} style={src ? { backgroundImage: `url(${JSON.stringify(src)})` } : undefined} />;
}
export function EditBookPanel({ service, book, close, done }: { book: BookInfo; done: () => void } & DialogProps) {
	const [title, setTitle] = useState(book.title),
		[author, setAuthor] = useState(book.author),
		[cover, setCover] = useState(book.coverUrl),
		[pages, setPages] = useState(String(book.totalPages || '')),
		[busy, setBusy] = useState(false),
		pending = useRef(false),
		input = useRef<HTMLInputElement>(null);
	useLayoutEffect(() => {
		input.current?.focus();
	}, []);
	const save = async (remove = false) => {
		if (pending.current || (!remove && !title.trim())) return;
		pending.current = true;
		setBusy(true);
		try {
			if (remove) await service.removeActiveBook(book.title);
			else
				await service.updateBookInfo(book.title, {
					title: title.trim(),
					author: author.trim(),
					coverUrl: cover.trim(),
					totalPages: Math.max(0, parseInt(pages) || 0),
				});
			close();
			done();
		} finally {
			pending.current = false;
			setBusy(false);
		}
	};
	return (
		<>
			<Header title="reading.editTitle" close={close} />
			<div class="dashboard-reading-end-body">
				<div class="dashboard-reading-end-label">{t('reading.editBookName')}</div>
				<input
					ref={input}
					class="dashboard-reading-end-input"
					value={title}
					onInput={(e) => setTitle(e.currentTarget.value)}
				/>
				<div class="dashboard-reading-end-label">{t('reading.editAuthorName')}</div>
				<input
					class="dashboard-reading-end-input"
					value={author}
					onInput={(e) => setAuthor(e.currentTarget.value)}
				/>
				<div class="dashboard-reading-end-label">{t('reading.editTotalPages')}</div>
				<input
					class="dashboard-reading-end-input"
					type="number"
					min="0"
					value={pages}
					onInput={(e) => setPages(e.currentTarget.value)}
				/>
				<div class="dashboard-reading-end-label">{t('reading.editCoverUrl')}</div>
				<input
					class="dashboard-reading-end-input"
					placeholder={t('reading.editCoverPlaceholder')}
					value={cover}
					onInput={(e) => setCover(e.currentTarget.value)}
				/>
			</div>
			<div class="dashboard-reading-end-footer">
				<button
					class="dashboard-reading-end-btn dashboard-reading-end-btn--confirm"
					disabled={busy}
					onClick={() => void save()}
				>
					{t('reading.editConfirm')}
				</button>
				<button class="dashboard-reading-end-btn dashboard-reading-end-btn--cancel" onClick={close}>
					{t('reading.endCancel')}
				</button>
				<button
					class="dashboard-reading-end-btn dashboard-reading-end-btn--delete"
					disabled={busy}
					onClick={() => void save(true)}
				>
					{t('reading.editDeleteBook')}
				</button>
			</div>
		</>
	);
}
export function BookSearchPanel({
	service,
	close,
	select,
	win,
}: { select: (book: BookInfo) => void; win: Window } & DialogProps) {
	const [query, setQuery] = useState(''),
		[manual, setManual] = useState(''),
		[results, setResults] = useState<BookSearchResult[]>([]),
		[busy, setBusy] = useState(false),
		input = useRef<HTMLInputElement>(null);
	useLayoutEffect(() => {
		input.current?.focus();
	}, []);
	useLayoutEffect(() => {
		let active = true;
		setResults([]);
		setBusy(!!query.trim());
		const timer = win.setTimeout(() => {
			if (!query.trim()) return;
			void searchBooks(query.trim())
				.then((items) => {
					if (active) setResults(items);
				})
				.catch(() => {})
				.finally(() => {
					if (active) setBusy(false);
				});
		}, 500);
		return () => {
			active = false;
			win.clearTimeout(timer);
		};
	}, [query, win]);
	const pick = (book: Pick<BookInfo, 'title' | 'author' | 'coverUrl' | 'isbn' | 'source'>) => {
		select({ ...book, currentPage: 0, totalPages: 0, finished: false });
		close();
	};
	return (
		<>
			<Header title="reading.selectBook" close={close} search />
			<div class="dashboard-reading-book-input-area">
				<input
					ref={input}
					class="dashboard-reading-book-input"
					value={query}
					placeholder={t('reading.searchBook')}
					onInput={(e) => setQuery(e.currentTarget.value)}
				/>
			</div>
			<div class="dashboard-reading-book-results">
				{busy ? (
					<div class="dashboard-reading-book-searching">{t('reading.searching')}</div>
				) : query.trim() && !results.length ? (
					<div class="dashboard-reading-book-no-results">{t('reading.noResults')}</div>
				) : (
					results.map((book, i) => (
						<div
							key={`${book.isbn}:${i}`}
							class="dashboard-reading-book-item"
							onClick={() => pick({ ...book, source: 'google' })}
						>
							{book.coverUrl ? (
								<Cover
									url={book.coverUrl}
									service={service}
									className="dashboard-reading-book-item-cover"
								/>
							) : (
								<div class="dashboard-reading-book-item-nocover" />
							)}
							<div class="dashboard-reading-book-item-info">
								<div class="dashboard-reading-book-item-title">{book.title}</div>
								{book.author && <div class="dashboard-reading-book-item-author">{book.author}</div>}
							</div>
						</div>
					))
				)}
				<div class="dashboard-reading-book-manual">
					<div class="dashboard-reading-book-manual-label">{t('reading.manualInput')}</div>
					<input
						class="dashboard-reading-book-manual-input"
						value={manual}
						placeholder={t('reading.manualPlaceholder')}
						onInput={(e) => setManual(e.currentTarget.value)}
					/>
					<button
						class="dashboard-reading-book-manual-btn"
						onClick={() => {
							if (manual.trim())
								pick({ title: manual.trim(), author: '', coverUrl: '', isbn: '', source: 'manual' });
						}}
					>
						OK
					</button>
				</div>
			</div>
		</>
	);
}
export function EndReadingPanel({
	service,
	book,
	elapsed,
	close,
	done,
}: { book: BookInfo; elapsed: number; done: () => void } & DialogProps) {
	const [mode, setMode] = useState<'page' | 'pct'>(book.totalPages > 0 ? 'page' : 'pct'),
		[end, setEnd] = useState(''),
		[total, setTotal] = useState(''),
		[finished, setFinished] = useState(false),
		[busy, setBusy] = useState(false),
		pending = useRef(false),
		input = useRef<HTMLInputElement>(null);
	useLayoutEffect(() => {
		input.current?.focus();
	}, [mode]);
	const now = new Date();
	const save = async () => {
		if (pending.current) return;
		pending.current = true;
		setBusy(true);
		try {
			const value = Math.max(0, parseInt(end) || 0);
			let pages = book.totalPages,
				endPage = value;
			if (mode === 'pct') {
				endPage = Math.round((Math.min(value, 100) / 100) * (pages || 100));
				pages = pages || 100;
			} else if (!pages) pages = Math.max(0, parseInt(total) || 0);
			await service.finishSession(endPage, pages, finished);
			close();
			done();
		} finally {
			pending.current = false;
			setBusy(false);
		}
	};
	return (
		<>
			<Header title="reading.endTitle" close={close} />
			<div class="dashboard-reading-end-body">
				{[
					{
						label: 'reading.endDate',
						value: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
					},
					{ label: 'reading.endDuration', value: formatReadingDuration(elapsed) },
				].map((row) => (
					<div key={row.label} class="dashboard-reading-end-row">
						<div class="dashboard-reading-end-label">{t(row.label)}</div>
						<div class="dashboard-reading-end-value">{row.value}</div>
					</div>
				))}
				<div class="dashboard-reading-end-section">
					<div class="dashboard-reading-end-section-title">{t('reading.endProgress')}</div>
					<div class="dashboard-reading-end-mode-toggle">
						{(['page', 'pct'] as const).map((value) => (
							<div
								key={value}
								class={`dashboard-reading-end-mode-btn${mode === value ? ' dashboard-reading-end-mode-btn--active' : ''}`}
								role="button"
								onClick={() => {
									setMode(value);
									setEnd('');
								}}
							>
								{t(value === 'page' ? 'reading.endModePage' : 'reading.endModePct')}
							</div>
						))}
					</div>
					<div class="dashboard-reading-end-inputs">
						<div class="dashboard-reading-end-page-row">
							<div class="dashboard-reading-end-page-col">
								<div class="dashboard-reading-end-page-label">{t('reading.endStartPage')}</div>
								<div class="dashboard-reading-end-page-readonly">
									{mode === 'pct'
										? `${book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0}%`
										: book.currentPage}
								</div>
							</div>
							<div class="dashboard-reading-end-page-arrow" />
							<div class="dashboard-reading-end-page-col">
								<div class="dashboard-reading-end-page-label">{t('reading.endEndPage')}</div>
								<input
									ref={input}
									class="dashboard-reading-end-page-input"
									type="number"
									min="0"
									max={mode === 'pct' ? 100 : undefined}
									placeholder={mode === 'pct' ? '0%' : '0'}
									value={end}
									onInput={(e) => setEnd(e.currentTarget.value)}
								/>
							</div>
						</div>
						{mode === 'page' && !book.totalPages && (
							<div class="dashboard-reading-end-total-row">
								<div class="dashboard-reading-end-page-label">{t('reading.endTotalPages')}</div>
								<input
									class="dashboard-reading-end-page-input dashboard-reading-end-page-input--total"
									type="number"
									min="0"
									placeholder="?"
									value={total}
									onInput={(e) => setTotal(e.currentTarget.value)}
								/>
							</div>
						)}
					</div>
				</div>
				<label class="dashboard-reading-end-finished">
					<input
						class="dashboard-reading-end-checkbox"
						type="checkbox"
						checked={finished}
						onChange={(e) => setFinished(e.currentTarget.checked)}
					/>
					<span class="dashboard-reading-end-checkbox-label">{t('reading.endMarkFinished')}</span>
				</label>
			</div>
			<div class="dashboard-reading-end-footer">
				<button class="dashboard-reading-end-btn dashboard-reading-end-btn--cancel" onClick={close}>
					{t('reading.endCancel')}
				</button>
				<button
					class="dashboard-reading-end-btn dashboard-reading-end-btn--discard"
					onClick={() => {
						service.discardSession();
						close();
						done();
					}}
				>
					{t('reading.endDiscard')}
				</button>
				<button
					class="dashboard-reading-end-btn dashboard-reading-end-btn--confirm"
					disabled={busy}
					onClick={() => void save()}
				>
					{t('reading.endConfirm')}
				</button>
			</div>
		</>
	);
}
export function ReadingStatsPanel({ service, close }: DialogProps) {
	useService(service);
	const [days, setDays] = useState(30),
		books = service.getBookBreakdownInRange(days),
		records = service.getRecentRecords(10);
	const summary = [
		{ label: 'reading.totalReading', value: formatReadingDuration(service.getTotalSeconds()) },
		{ label: 'reading.todayReading', value: formatReadingDuration(service.getTodaySeconds()) },
		{ label: 'reading.bookCount', value: service.getBookCountInRange(365) },
		{ label: 'reading.streakDays', value: service.getStreak() },
	];
	return (
		<>
			<div class="dashboard-pomodoro-stats-header">
				<div class="dashboard-pomodoro-stats-header-title">{t('reading.statsTitle')}</div>
				<div class="dashboard-pomodoro-stats-close" role="button" onClick={close}>
					<Icon name="x" />
				</div>
			</div>
			<div class="dashboard-reading-stats-content">
				<div class="dashboard-reading-stats-card">
					<div class="dashboard-reading-stats-summary">
						{summary.map((item) => (
							<div key={item.label} class="dashboard-reading-stats-summary-item">
								<div class="dashboard-reading-stats-summary-value">{item.value}</div>
								<div class="dashboard-reading-stats-summary-label">{t(item.label)}</div>
							</div>
						))}
					</div>
				</div>
				<div class="dashboard-reading-stats-card">
					<div class="dashboard-reading-stats-card-title">{t('reading.bookList')}</div>
					<div class="dashboard-reading-stats-range">
						{[
							{ days: 7, key: 'Week' },
							{ days: 30, key: 'Month' },
							{ days: 365, key: 'Year' },
						].map((range) => (
							<div
								key={range.key}
								class={`dashboard-reading-stats-range-btn${days === range.days ? ' dashboard-reading-stats-range-btn--active' : ''}`}
								role="button"
								onClick={() => setDays(range.days)}
							>
								{t(`reading.range${range.key}`)}
							</div>
						))}
					</div>
					<div class="dashboard-reading-book-list">
						{!books.length ? (
							<div class="dashboard-reading-stats-empty">{t('reading.noRecords')}</div>
						) : (
							books.map((book) => (
								<div key={book.title} class="dashboard-reading-book-list-row">
									{book.coverUrl ? (
										<Cover
											url={book.coverUrl}
											service={service}
											className="dashboard-reading-book-list-cover"
										/>
									) : (
										<div class="dashboard-reading-book-list-nocover" />
									)}
									<div class="dashboard-reading-book-list-info">
										<div class="dashboard-reading-book-list-title">{book.title}</div>
										{book.author && (
											<div class="dashboard-reading-book-list-author">{book.author}</div>
										)}
									</div>
									<div class="dashboard-reading-book-list-meta">
										<div class="dashboard-reading-book-list-duration">
											{formatReadingDuration(book.totalSeconds)}
										</div>
										<div class="dashboard-reading-book-list-sessions">
											{t('reading.times', { count: book.sessions })}
										</div>
										<div
											class="dashboard-reading-stats-record-del"
											role="button"
											onClick={() => void service.deleteBookRecords(book.title)}
										>
											<Icon name="trash-2" />
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</div>
				{records.length > 0 && (
					<div class="dashboard-reading-stats-card">
						<div class="dashboard-reading-stats-card-title">{t('reading.recentRecords')}</div>
						{records.map((record) => {
							const ts = new Date(record.timestamp);
							return (
								<div key={record.timestamp} class="dashboard-reading-stats-record">
									<div class="dashboard-reading-stats-record-date">
										{ts.getMonth() + 1}/{ts.getDate()} {String(ts.getHours()).padStart(2, '0')}:
										{String(ts.getMinutes()).padStart(2, '0')}
									</div>
									<div class="dashboard-reading-stats-record-book">{record.bookTitle}</div>
									<div class="dashboard-reading-stats-record-dur">
										{formatReadingDuration(record.durationSeconds)}
									</div>
									<div
										class="dashboard-reading-stats-record-del"
										role="button"
										onClick={() => void service.deleteRecord(record.timestamp)}
									>
										<Icon name="trash-2" />
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</>
	);
}
