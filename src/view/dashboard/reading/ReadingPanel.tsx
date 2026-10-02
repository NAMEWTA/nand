import { SaveStatus } from '../../primitives/SaveStatus';
import { useLayoutEffect, useState } from 'preact/hooks';
import { resolveCoverAsObjectUrl } from '../../../platform/obsidian/reading/book-service';
import type { BookInfo, ReadingService } from '../../../platform/obsidian/reading/reading-service';
import { t } from '../../../shared/i18n/index';
import { Icon } from '../../primitives/Icon';
import { useService } from '../widgets/use-service';
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
		setUrl('');
		if (book.coverUrl)
			void resolveCoverAsObjectUrl(book.coverUrl, service.getApp()).then((value) => {
				if (!disposed) setUrl(value || '');
			});
		return () => {
			disposed = true;
		};
	}, [book.coverUrl, service]);
	return (
		<div
			class="dashboard-reading-book-card-cover-wrap"
			style={url ? { backgroundImage: `url(${url})` } : undefined}
		>
			{!url && (
				<div class="dashboard-reading-book-card-cover-placeholder">
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
	return (
		<>
			<SaveStatus source={service} />
			<div class="dashboard-reading-title-row">
				<div class="dashboard-reading-title">{t('reading.title')}</div>
				<div class="dashboard-reading-title-spacer" />
				<div class="dashboard-reading-add-btn" role="button" tabIndex={0} aria-label={t('reading.selectBook')} onClick={add}>
					<Icon name="plus" />
				</div>
				<div class="dashboard-reading-stats-btn" role="button" tabIndex={0} aria-label={t('reading.statsTitle')} onClick={statistics}>
					<Icon name="bar-chart-2" />
				</div>
			</div>
			<div class="dashboard-reading-scroll">
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
							class={`dashboard-reading-book-card${active ? ' dashboard-reading-book-card--active' : ''}`}
						>
							<BookCover book={book} service={service} />
							<div class="dashboard-reading-book-card-info">
								<div class="dashboard-reading-book-card-title">{book.title}</div>
								{book.author && <div class="dashboard-reading-book-card-author">{book.author}</div>}
								<div class="dashboard-reading-book-card-timer">
									<div
										class={`dashboard-reading-book-card-time${active ? ' dashboard-reading-book-card-time--active' : ''}`}
									>
										{active
											? formatTimer(state.elapsedSeconds)
											: seconds > 0
												? hours
													? `${hours}h${minutes ? minutes + 'm' : ''}`
													: `${minutes}m`
												: '--'}
									</div>
									<div class="dashboard-reading-book-card-actions">
										<div
											role="button"
											tabIndex={0}
											class={`dashboard-reading-book-card-btn dashboard-reading-book-card-btn--${running ? 'pause' : 'play'}`}
											onClick={() => {
												if (running) service.pause();
												else if (active) service.resume();
												else service.startReading(book);
											}}
										>
											<Icon name={running ? 'pause' : 'play'} />
										</div>
										{active && (
											<div
												role="button"
												tabIndex={0}
												class="dashboard-reading-book-card-btn dashboard-reading-book-card-btn--stop"
												onClick={() => {
													if (running) service.pause();
													finish(book);
												}}
											>
												<Icon name="square" />
											</div>
										)}
									</div>
								</div>
								{book.totalPages > 0 && (
									<div class="dashboard-reading-book-card-progress">
										<div class="dashboard-reading-book-card-progress-bar">
											<div
												class={`dashboard-reading-book-card-progress-fill${book.finished ? ' dashboard-reading-book-card-progress-fill--done' : ''}`}
												style={{ width: `${percent}%` }}
											/>
										</div>
										<div class="dashboard-reading-book-card-progress-text">
											{book.finished ? '100%' : `${book.currentPage}/${book.totalPages}`}
										</div>
									</div>
								)}
							</div>
							<div
								class="dashboard-reading-book-card-action dashboard-reading-book-card-edit"
								role="button"
								tabIndex={0}
								onClick={() => edit(book)}
							>
								<Icon name="pencil" />
							</div>
							<div
								class="dashboard-reading-book-card-action dashboard-reading-book-card-remove"
								role="button"
								tabIndex={0}
								onClick={() => {
									void service.removeActiveBook(book.title);
								}}
							>
								<Icon name="x" />
							</div>
						</div>
					);
				})}
			</div>
		</>
	);
}
