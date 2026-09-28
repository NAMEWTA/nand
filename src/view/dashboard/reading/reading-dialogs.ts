import { h } from 'preact';
import type { BookInfo, ReadingService } from '../../../platform/obsidian/reading/reading-service';
import { DashboardPanelModal } from '../ui/panel-modal';
import { BookSearchPanel, EditBookPanel, EndReadingPanel, ReadingStatsPanel } from './ReadingDialogs';
export function openEditBookInfo(_doc: Document, service: ReadingService, book: BookInfo, onDone: () => void): void {
	new DashboardPanelModal(
		service.getApp(),
		'dashboard-reading-end-modal',
		(close) => h(EditBookPanel, { service, book, close, done: onDone }),
		service,
	).open();
}
export function openBookSearch(
	_doc: Document,
	service: ReadingService,
	onSelect: (book: BookInfo | null) => void,
): void {
	new DashboardPanelModal(
		service.getApp(),
		'dashboard-reading-book-modal',
		(close, root) => h(BookSearchPanel, { service, close, win: root.ownerDocument.defaultView!, select: onSelect }),
		service,
	).open();
}
export function showReadingStats(_doc: Document, service: ReadingService): void {
	new DashboardPanelModal(
		service.getApp(),
		'dashboard-pomodoro-stats-modal',
		(close) => h(ReadingStatsPanel, { service, close }),
		service,
	).open();
}
export function openEndReadingModal(
	_doc: Document,
	service: ReadingService,
	book: BookInfo,
	elapsedSeconds: number,
	onDone: () => void,
): void {
	new DashboardPanelModal(
		service.getApp(),
		'dashboard-reading-end-modal',
		(close) => h(EndReadingPanel, { service, book, elapsed: elapsedSeconds, close, done: onDone }),
		service,
	).open();
}
