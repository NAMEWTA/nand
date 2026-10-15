// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts
import { RecordConfirm } from '../dialogs/RecordConfirm';
import { RecordButton as Button } from '../dialogs/RecordButton';
import { widgetClasses } from '../theme/widget-classes';
import { RecordSaveStatus as SaveStatus } from '../dialogs/RecordSaveStatus';
import { useLayoutEffect, useState } from 'react';
import { resolveCoverAsObjectUrl } from '../../platform/reading/book-service';
import type { BookInfo, ReadingService } from '../../platform/reading/reading-service';
import { t } from '../../../../shared/i18n/index';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
import { useService } from '../widgets/use-record-service';
export function formatTimer(seconds: number): string {
	const hours = Math.floor(seconds / 3600),
		minutes = Math.floor((seconds % 3600) / 60),
		remainder = seconds % 60;
	return (
		(hours ? `${String(hours).padStart(2, '0')}:` : '') +
		`${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
	);
}
function BookCover({ book, service }: { book: BookInfo; service: ReadingService }) {
	const [url, setUrl] = useState('');
	useLayoutEffect(() => {
		let disposed = false;
		let owned = '';
		if (book.coverUrl)
			void resolveCoverAsObjectUrl(book.coverUrl, service.getApp()).then((value) => {
				if (disposed) {
					if (value.startsWith('blob:')) URL.revokeObjectURL(value);
				} else {
					owned = value;
					setUrl(value || '');
				}
			});
		return () => {
			disposed = true;
			if (owned.startsWith('blob:')) URL.revokeObjectURL(owned);
		};
	}, [book.coverUrl, service]);
	return (
		<div
			className={widgetClasses('dashboard-reading-book-card-cover-wrap')}
			style={book.coverUrl && url ? { backgroundImage: `url(${url})` } : undefined}
		>
			{(!book.coverUrl || !url) && (
				<div className={widgetClasses('dashboard-reading-book-card-cover-placeholder')}>
					{book.title.length > 8 ? book.title.slice(0, 8) + '..' : book.title}
				</div>
			)}
		</div>
	);
}
export function ReadingPanel({
	service,
	add,
	statistics,
	edit,
	finish,
}: {
	service: ReadingService;
	add: () => void;
	statistics: () => void;
	edit: (book: BookInfo) => void;
	finish: (book: BookInfo) => void;
}) {
	useService(service);
	const state = service.getState();
	const [removing, setRemoving] = useState<string | null>(null);
	return (
		<>
			<SaveStatus source={service} />
			<RecordConfirm open={removing !== null} onOpenChange={open => { if (!open) setRemoving(null); }}
				title={t('reading.editDeleteBook')} description={t('reading.removeBookConfirm', { title: removing ?? '' })}
				onConfirm={() => { if (removing !== null) void service.removeActiveBook(removing); setRemoving(null); }} />
			<div className={widgetClasses('dashboard-reading-title-row')}>
				<div className={widgetClasses('dashboard-reading-title')}>{t('reading.title')}</div>
				<div className={widgetClasses('dashboard-reading-title-spacer')} />
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-reading-add-btn')}
					role="button"
					tabIndex={0}
					aria-label={t('reading.selectBook')}
					onClick={add}
				>
					<Icon name="plus" />
				</Button>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-reading-stats-btn')}
					role="button"
					tabIndex={0}
					aria-label={t('reading.statsTitle')}
					onClick={statistics}
				>
					<Icon name="bar-chart-2" />
				</Button>
			</div>
			<div className={widgetClasses('dashboard-reading-scroll')}>
				{service.getActiveBooks().map((book) => {
					const active = state.status !== 'idle' && state.currentBook?.title === book.title,
						running = active && state.status === 'running';
					const seconds = service.getTodaySecondsForBook(book.title),
						hours = Math.floor(seconds / 3600),
						minutes = Math.floor((seconds % 3600) / 60);
					const percent = book.finished
						? 100
						: Math.min(100, Math.round((book.currentPage / book.totalPages) * 100));
					return (
						<div
							key={book.title + ':' + book.isbn}
							className={widgetClasses(
								`dashboard-reading-book-card${active ? ' dashboard-reading-book-card--active' : ''}`,
							)}
						>
							<BookCover book={book} service={service} />
							<div className={widgetClasses('dashboard-reading-book-card-info')}>
								<div className={widgetClasses('dashboard-reading-book-card-title')}>{book.title}</div>
								{book.author && (
									<div className={widgetClasses('dashboard-reading-book-card-author')}>
										{book.author}
									</div>
								)}
								<div className={widgetClasses('dashboard-reading-book-card-timer')}>
									<div
										className={widgetClasses(
											`dashboard-reading-book-card-time${active ? ' dashboard-reading-book-card-time--active' : ''}`,
										)}
									>
										{active
											? formatTimer(state.elapsedSeconds)
											: seconds > 0
												? hours
													? `${hours}h${minutes ? minutes + 'm' : ''}`
													: `${minutes}m`
												: '--'}
									</div>
									<div className={widgetClasses('dashboard-reading-book-card-actions')}>
										<Button
											variant="ghost"
											role="button"
											tabIndex={0}
											className={widgetClasses(
												`dashboard-reading-book-card-btn dashboard-reading-book-card-btn--${running ? 'pause' : 'play'}`,
											)}
											aria-label={t(running ? 'home.dashboard.pause' : 'reading.start')}
											onClick={() => {
												if (running) service.pause();
												else if (active) service.resume();
												else service.startReading(book);
											}}
										>
											<Icon name={running ? 'pause' : 'play'} />
										</Button>
										{active && (
											<Button
												variant="ghost"
												role="button"
												tabIndex={0}
												className={widgetClasses(
													'dashboard-reading-book-card-btn dashboard-reading-book-card-btn--stop',
												)}
												aria-label={t('reading.endTitle')}
													onClick={() => {
													if (running) service.pause();
													finish(book);
												}}
											>
												<Icon name="square" />
											</Button>
										)}
									</div>
								</div>
								{book.totalPages > 0 && (
									<div className={widgetClasses('dashboard-reading-book-card-progress')}>
										<div className={widgetClasses('dashboard-reading-book-card-progress-bar')}>
											<div
												className={widgetClasses(
													`dashboard-reading-book-card-progress-fill${book.finished ? ' dashboard-reading-book-card-progress-fill--done' : ''}`,
												)}
												style={{ width: `${percent}%` }}
											/>
										</div>
										<div className={widgetClasses('dashboard-reading-book-card-progress-text')}>
											{book.finished ? '100%' : `${book.currentPage}/${book.totalPages}`}
										</div>
									</div>
								)}
							</div>
							<Button
								variant="ghost"
								className={widgetClasses(
									'dashboard-reading-book-card-action dashboard-reading-book-card-edit',
								)}
								role="button"
								tabIndex={0}
								aria-label={t('reading.editTitle')}
								onClick={() => edit(book)}
							>
								<Icon name="pencil" />
							</Button>
							<Button
								variant="ghost"
								className={widgetClasses(
									'dashboard-reading-book-card-action dashboard-reading-book-card-remove',
								)}
								role="button"
								tabIndex={0}
								aria-label={t('reading.editDeleteBook')}
								onClick={() => setRemoving(book.title)}
							>
								<Icon name="x" />
							</Button>
						</div>
					);
				})}
			</div>
		</>
	);
}
