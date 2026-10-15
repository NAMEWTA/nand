// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads, src/renderer.ts (reading dialogs)
import { createElement as h } from 'react';
import { t } from '../../../../shared/i18n';
import type { BookInfo, ReadingService } from '../../platform/reading/reading-service';
import { openRecordDialog } from '../dialogs/open-record-dialog';
import { BookSearchPanel, EditBookPanel, EndReadingPanel, ReadingStatsPanel } from './ReadingDialogs';
export function openEditBookInfo(doc: Document, service: ReadingService, book: BookInfo, onDone: () => void): void {
	openRecordDialog(doc, t('reading.title'), 'dashboard-reading-end-modal', (close) =>
		h(EditBookPanel, { service, book, close, done: onDone }),
	);
}
export function openBookSearch(
	doc: Document,
	service: ReadingService,
	onSelect: (book: BookInfo | null) => void,
): void {
	openRecordDialog(doc, t('reading.title'), 'dashboard-reading-book-modal', (close, root) =>
		h(BookSearchPanel, { service, close, win: root.ownerDocument.defaultView!, select: onSelect }),
	);
}
export function showReadingStats(doc: Document, service: ReadingService): void {
	openRecordDialog(doc, t('reading.title'), 'dashboard-pomodoro-stats-modal', (close) =>
		h(ReadingStatsPanel, { service, close }),
	);
}
export function openEndReadingModal(
	doc: Document,
	service: ReadingService,
	book: BookInfo,
	elapsedSeconds: number,
	onDone: () => void,
): void {
	openRecordDialog(doc, t('reading.title'), 'dashboard-reading-end-modal', (close) =>
		h(EndReadingPanel, { service, book, elapsed: elapsedSeconds, close, done: onDone }),
	);
}
