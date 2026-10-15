import { RecordSaveStatus } from '../dialogs/RecordSaveStatus';
import { Checkbox } from '../../../../ui/components/checkbox';
// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts
import { RecordConfirm } from '../dialogs/RecordConfirm';
import { RecordButton as Button } from '../dialogs/RecordButton';
import { Input } from '../../../../ui/components/input';
import { widgetClasses } from '../theme/widget-classes';
import { useLayoutEffect, useRef, useState } from 'react';
import { formatReadingDuration } from '../../core/reading/duration';
import { resolveCoverAsObjectUrl, searchBooks, type BookSearchResult } from '../../platform/reading/book-service';
import type { BookInfo, ReadingService } from '../../platform/reading/reading-service';
import { t } from '../../../../shared/i18n';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
import { useService } from '../widgets/use-record-service';
interface DialogProps {
	service: ReadingService;
	close: () => void;
}
function Header({ title, close, search = false }: { title: string; close: () => void; search?: boolean }) {
	return (
		<div className={widgetClasses(search ? 'dashboard-reading-book-header' : 'dashboard-reading-end-header')}>
			<div
				className={widgetClasses(
					search ? 'dashboard-reading-book-header-title' : 'dashboard-reading-end-title',
				)}
			>
				{t(title)}
			</div>
			<Button
				variant="ghost"
				className={widgetClasses(search ? 'dashboard-reading-book-close' : 'dashboard-reading-end-close')}
				role="button"
				aria-label={t('common.close')}
				onClick={close}
			>
				<Icon name="x" />
			</Button>
		</div>
	);
}
function Cover({ url, service, className }: { url: string; service: ReadingService; className: string }) {
	const [src, setSrc] = useState('');
	useLayoutEffect(() => {
		let active = true;
		let owned = '';
		if (url)
			void resolveCoverAsObjectUrl(url, service.getApp()).then((value) => {
				if (active) {
					owned = value;
					setSrc(value ?? '');
				} else if (value.startsWith('blob:')) URL.revokeObjectURL(value);
			});
		return () => {
			active = false;
			if (owned.startsWith('blob:')) URL.revokeObjectURL(owned);
		};
	}, [url, service]);
	return (
		<div
			className={widgetClasses(className)}
			style={src ? { backgroundImage: `url(${JSON.stringify(src)})` } : undefined}
		/>
	);
}
export function EditBookPanel({ service, book, close, done }: { book: BookInfo; done: () => void } & DialogProps) {
	const [title, setTitle] = useState(book.title),
		[removing, setRemoving] = useState(false),
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
			await service.flush();
			close();
			done();
		} catch {
			// Save status retains the failed draft and offers retry.
		} finally {
			pending.current = false;
			setBusy(false);
		}
	};
	return (
		<>
			<Header title="reading.editTitle" close={close} />
			<RecordSaveStatus source={service} />
			<RecordConfirm open={removing} onOpenChange={setRemoving} title={t('reading.editDeleteBook')}
				description={t('reading.removeBookConfirm', { title: book.title })} onConfirm={() => { void save(true); }} />
			<div className={widgetClasses('dashboard-reading-end-body')}>
				<div className={widgetClasses('dashboard-reading-end-label')}>{t('reading.editBookName')}</div>
				<Input
					ref={input}
					className={widgetClasses('dashboard-reading-end-input')}
					aria-label={t('reading.editBookName')}
					value={title}
					onInput={(e) => setTitle(e.currentTarget.value)}
				/>
				<div className={widgetClasses('dashboard-reading-end-label')}>{t('reading.editAuthorName')}</div>
				<Input
					className={widgetClasses('dashboard-reading-end-input')}
					aria-label={t('reading.editAuthorName')}
					value={author}
					onInput={(e) => setAuthor(e.currentTarget.value)}
				/>
				<div className={widgetClasses('dashboard-reading-end-label')}>{t('reading.editTotalPages')}</div>
				<Input
					className={widgetClasses('dashboard-reading-end-input')}
					type="number"
					min="0"
					aria-label={t('reading.editTotalPages')}
					value={pages}
					onInput={(e) => setPages(e.currentTarget.value)}
				/>
				<div className={widgetClasses('dashboard-reading-end-label')}>{t('reading.editCoverUrl')}</div>
				<Input
					className={widgetClasses('dashboard-reading-end-input')}
					placeholder={t('reading.editCoverPlaceholder')}
					aria-label={t('reading.editCoverUrl')}
					value={cover}
					onInput={(e) => setCover(e.currentTarget.value)}
				/>
			</div>
			<div className={widgetClasses('dashboard-reading-end-footer')}>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-reading-end-btn dashboard-reading-end-btn--confirm')}
					disabled={busy}
					onClick={() => void save()}
				>
					{t('reading.editConfirm')}
				</Button>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-reading-end-btn dashboard-reading-end-btn--cancel')}
					onClick={close}
				>
					{t('reading.endCancel')}
				</Button>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-reading-end-btn dashboard-reading-end-btn--delete')}
					disabled={busy}
					onClick={() => setRemoving(true)}
				>
					{t('reading.editDeleteBook')}
				</Button>
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
			<div className={widgetClasses('dashboard-reading-book-input-area')}>
				<Input
					ref={input}
					className={widgetClasses('dashboard-reading-book-input')}
					aria-label={t('reading.searchBook')}
					value={query}
					placeholder={t('reading.searchBook')}
					onInput={(e) => {
						setQuery(e.currentTarget.value);
						setResults([]);
						setBusy(!!e.currentTarget.value.trim());
					}}
				/>
			</div>
			<div className={widgetClasses('dashboard-reading-book-results')}>
				{busy ? (
					<div className={widgetClasses('dashboard-reading-book-searching')}>{t('reading.searching')}</div>
				) : query.trim() && !results.length ? (
					<div className={widgetClasses('dashboard-reading-book-no-results')}>{t('reading.noResults')}</div>
				) : (
					results.map((book, i) => (
						<div
							key={`${book.isbn}:${i}`}
							className={widgetClasses('dashboard-reading-book-item')}
							role="button"
							tabIndex={0}
							onKeyDown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									pick({ ...book, source: 'google' });
								}
							}}
							onClick={() => pick({ ...book, source: 'google' })}
						>
							{book.coverUrl ? (
								<Cover
									url={book.coverUrl}
									service={service}
									className={widgetClasses('dashboard-reading-book-item-cover')}
								/>
							) : (
								<div className={widgetClasses('dashboard-reading-book-item-nocover')} />
							)}
							<div className={widgetClasses('dashboard-reading-book-item-info')}>
								<div className={widgetClasses('dashboard-reading-book-item-title')}>{book.title}</div>
								{book.author && (
									<div className={widgetClasses('dashboard-reading-book-item-author')}>
										{book.author}
									</div>
								)}
							</div>
						</div>
					))
				)}
				<div className={widgetClasses('dashboard-reading-book-manual')}>
					<div className={widgetClasses('dashboard-reading-book-manual-label')}>
						{t('reading.manualInput')}
					</div>
					<Input
						className={widgetClasses('dashboard-reading-book-manual-input')}
						aria-label={t('reading.manualInput')}
						value={manual}
						placeholder={t('reading.manualPlaceholder')}
						onInput={(e) => setManual(e.currentTarget.value)}
					/>
					<Button
						variant="ghost"
						className={widgetClasses('dashboard-reading-book-manual-btn')}
						onClick={() => {
							if (manual.trim())
								pick({ title: manual.trim(), author: '', coverUrl: '', isbn: '', source: 'manual' });
						}}
					>
						{t('common.confirm')}
					</Button>
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
			<div className={widgetClasses('dashboard-reading-end-body')}>
				{[
					{
						label: 'reading.endDate',
						value: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
					},
					{ label: 'reading.endDuration', value: formatReadingDuration(elapsed) },
				].map((row) => (
					<div key={row.label} className={widgetClasses('dashboard-reading-end-row')}>
						<div className={widgetClasses('dashboard-reading-end-label')}>{t(row.label)}</div>
						<div className={widgetClasses('dashboard-reading-end-value')}>{row.value}</div>
					</div>
				))}
				<div className={widgetClasses('dashboard-reading-end-section')}>
					<div className={widgetClasses('dashboard-reading-end-section-title')}>
						{t('reading.endProgress')}
					</div>
					<div className={widgetClasses('dashboard-reading-end-mode-toggle')}>
						{(['page', 'pct'] as const).map((value) => (
							<Button
								variant="ghost"
								key={value}
								className={widgetClasses(
									`dashboard-reading-end-mode-btn${mode === value ? ' dashboard-reading-end-mode-btn--active' : ''}`,
								)}
								role="button"
								onClick={() => {
									setMode(value);
									setEnd('');
								}}
							>
								{t(value === 'page' ? 'reading.endModePage' : 'reading.endModePct')}
							</Button>
						))}
					</div>
					<div className={widgetClasses('dashboard-reading-end-inputs')}>
						<div className={widgetClasses('dashboard-reading-end-page-row')}>
							<div className={widgetClasses('dashboard-reading-end-page-col')}>
								<div className={widgetClasses('dashboard-reading-end-page-label')}>
									{t('reading.endStartPage')}
								</div>
								<div className={widgetClasses('dashboard-reading-end-page-readonly')}>
									{mode === 'pct'
										? `${book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0}%`
										: book.currentPage}
								</div>
							</div>
							<div className={widgetClasses('dashboard-reading-end-page-arrow')} />
							<div className={widgetClasses('dashboard-reading-end-page-col')}>
								<div className={widgetClasses('dashboard-reading-end-page-label')}>
									{t('reading.endEndPage')}
								</div>
								<Input
									ref={input}
									className={widgetClasses('dashboard-reading-end-page-input')}
									type="number"
									min="0"
									max={mode === 'pct' ? 100 : undefined}
									placeholder={mode === 'pct' ? '0%' : '0'}
									aria-label={t('reading.endEndPage')}
									value={end}
									onInput={(e) => setEnd(e.currentTarget.value)}
								/>
							</div>
						</div>
						{mode === 'page' && !book.totalPages && (
							<div className={widgetClasses('dashboard-reading-end-total-row')}>
								<div className={widgetClasses('dashboard-reading-end-page-label')}>
									{t('reading.endTotalPages')}
								</div>
								<Input
									className={widgetClasses(
										'dashboard-reading-end-page-input dashboard-reading-end-page-input--total',
									)}
									type="number"
									min="0"
									placeholder="?"
									aria-label={t('reading.endTotalPages')}
									value={total}
									onInput={(e) => setTotal(e.currentTarget.value)}
								/>
							</div>
						)}
					</div>
				</div>
				<label className={widgetClasses('dashboard-reading-end-finished')}>
					<Checkbox
						className={widgetClasses('dashboard-reading-end-checkbox')}

						checked={finished}
						onCheckedChange={(checked) => setFinished(checked === true)}
					/>
					<span className={widgetClasses('dashboard-reading-end-checkbox-label')}>
						{t('reading.endMarkFinished')}
					</span>
				</label>
			</div>
			<div className={widgetClasses('dashboard-reading-end-footer')}>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-reading-end-btn dashboard-reading-end-btn--cancel')}
					onClick={close}
				>
					{t('reading.endCancel')}
				</Button>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-reading-end-btn dashboard-reading-end-btn--discard')}
					onClick={() => {
						service.discardSession();
						close();
						done();
					}}
				>
					{t('reading.endDiscard')}
				</Button>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-reading-end-btn dashboard-reading-end-btn--confirm')}
					disabled={busy}
					onClick={() => void save()}
				>
					{t('reading.endConfirm')}
				</Button>
			</div>
		</>
	);
}
export function ReadingStatsPanel({ service, close }: { service: ReadingService; close?: () => void }) {
	useService(service);
	const [deleting, setDeleting] = useState<{ title?: string; timestamp?: string } | null>(null);
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
			<RecordSaveStatus source={service} />
			<RecordConfirm open={deleting !== null} onOpenChange={open => { if (!open) setDeleting(null); }}
				title={t('common.delete')}
				description={deleting?.title !== undefined ? t('reading.deleteBookRecordsConfirm', { title: deleting.title }) : t('reading.deleteRecordConfirm')}
				onConfirm={() => {
					if (deleting?.title !== undefined) void service.deleteBookRecords(deleting.title);
					else if (deleting?.timestamp) void service.deleteRecord(deleting.timestamp);
					setDeleting(null);
				}} />
			<div className={widgetClasses('dashboard-pomodoro-stats-header')}>
				<div className={widgetClasses('dashboard-pomodoro-stats-header-title')}>{t('reading.statsTitle')}</div>
				{close && (
					<Button
						variant="ghost"
						className={widgetClasses('dashboard-pomodoro-stats-close')}
						role="button"
						aria-label={t('common.close')}
						onClick={close}
					>
						<Icon name="x" />
					</Button>
				)}
			</div>
			<div className={widgetClasses('dashboard-reading-stats-content')}>
				<div className={widgetClasses('dashboard-reading-stats-card')}>
					<div className={widgetClasses('dashboard-reading-stats-summary')}>
						{summary.map((item) => (
							<div key={item.label} className={widgetClasses('dashboard-reading-stats-summary-item')}>
								<div className={widgetClasses('dashboard-reading-stats-summary-value')}>
									{item.value}
								</div>
								<div className={widgetClasses('dashboard-reading-stats-summary-label')}>
									{t(item.label)}
								</div>
							</div>
						))}
					</div>
				</div>
				<div className={widgetClasses('dashboard-reading-stats-card')}>
					<div className={widgetClasses('dashboard-reading-stats-card-title')}>{t('reading.bookList')}</div>
					<div className={widgetClasses('dashboard-reading-stats-range')}>
						{[
							{ days: 7, key: 'Week' },
							{ days: 30, key: 'Month' },
							{ days: 365, key: 'Year' },
						].map((range) => (
							<Button
								variant="ghost"
								key={range.key}
								className={widgetClasses(
									`dashboard-reading-stats-range-btn${days === range.days ? ' dashboard-reading-stats-range-btn--active' : ''}`,
								)}
								role="button"
								onClick={() => setDays(range.days)}
							>
								{t(`reading.range${range.key}`)}
							</Button>
						))}
					</div>
					<div className={widgetClasses('dashboard-reading-book-list')}>
						{!books.length ? (
							<div className={widgetClasses('dashboard-reading-stats-empty')}>
								{t('reading.noRecords')}
							</div>
						) : (
							books.map((book) => (
								<div key={book.title} className={widgetClasses('dashboard-reading-book-list-row')}>
									{book.coverUrl ? (
										<Cover
											url={book.coverUrl}
											service={service}
											className={widgetClasses('dashboard-reading-book-list-cover')}
										/>
									) : (
										<div className={widgetClasses('dashboard-reading-book-list-nocover')} />
									)}
									<div className={widgetClasses('dashboard-reading-book-list-info')}>
										<div className={widgetClasses('dashboard-reading-book-list-title')}>
											{book.title}
										</div>
										{book.author && (
											<div className={widgetClasses('dashboard-reading-book-list-author')}>
												{book.author}
											</div>
										)}
									</div>
									<div className={widgetClasses('dashboard-reading-book-list-meta')}>
										<div className={widgetClasses('dashboard-reading-book-list-duration')}>
											{formatReadingDuration(book.totalSeconds)}
										</div>
										<div className={widgetClasses('dashboard-reading-book-list-sessions')}>
											{t('reading.times', { count: book.sessions })}
										</div>
										<Button
											variant="ghost"
											className={widgetClasses('dashboard-reading-stats-record-del')}
											role="button"
											aria-label={t('reading.editDeleteBook')}
											onClick={() => setDeleting({ title: book.title })}
										>
											<Icon name="trash-2" />
										</Button>
									</div>
								</div>
							))
						)}
					</div>
				</div>
				{records.length > 0 && (
					<div className={widgetClasses('dashboard-reading-stats-card')}>
						<div className={widgetClasses('dashboard-reading-stats-card-title')}>
							{t('reading.recentRecords')}
						</div>
						{records.map((record) => {
							const ts = new Date(record.timestamp);
							return (
								<div key={record.timestamp} className={widgetClasses('dashboard-reading-stats-record')}>
									<div className={widgetClasses('dashboard-reading-stats-record-date')}>
										{ts.getMonth() + 1}/{ts.getDate()} {String(ts.getHours()).padStart(2, '0')}:
										{String(ts.getMinutes()).padStart(2, '0')}
									</div>
									<div className={widgetClasses('dashboard-reading-stats-record-book')}>
										{record.bookTitle}
									</div>
									<div className={widgetClasses('dashboard-reading-stats-record-dur')}>
										{formatReadingDuration(record.durationSeconds)}
									</div>
									<Button
										variant="ghost"
										className={widgetClasses('dashboard-reading-stats-record-del')}
										role="button"
										aria-label={t('common.delete')}
										onClick={() => setDeleting({ timestamp: record.timestamp })}
									>
										<Icon name="trash-2" />
									</Button>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</>
	);
}
