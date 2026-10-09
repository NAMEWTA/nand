import { WereadBookLike } from '../../core/weread/widget-model';
import { t } from '../../../../shared/i18n/index';

/** Min book card width + grid gap, used to estimate how many columns fit. */
export const SHELF_CARD_MIN = 110;

export const SHELF_GAP = 8;

export const SHELF_ROW_HEIGHT = 200;

export function computeShelfCapacity(content: HTMLElement): number {
	const section = content.closest('.dashboard-section-row');
	if (!section) return 12;
	const width = section.clientWidth;
	const maxH = parseInt(section.ownerDocument.defaultView!.getComputedStyle(section).maxHeight, 10) || 800;
	const cols = Math.max(1, Math.floor((width + SHELF_GAP) / (SHELF_CARD_MIN + SHELF_GAP)));
	// Subtract header + section padding + pager overhead.
	const availH = Math.max(SHELF_ROW_HEIGHT, maxH - 130);
	const rows = Math.max(1, Math.floor(availH / SHELF_ROW_HEIGHT));
	return Math.max(6, Math.min(cols * rows, 60));
}

export function groupLabel(key: string): string {
	const labels: Record<string, string> = {
		reading: 'weread.progressReading',
		finished: 'weread.progressFinished',
		notStarted: 'weread.progressNotStarted',
		book: 'weread.contentBook',
		audio: 'weread.contentAudio',
		article: 'weread.contentArticle',
		recent7: 'weread.recent7',
		recent30: 'weread.recent30',
		older: 'weread.recentOlder',
		never: 'weread.recentNever',
		highlights: 'weread.notesHighlights',
		ideas: 'weread.notesIdeas',
		none: 'weread.notesNone',
	};
	return t(labels[key] ?? 'weread.groupNone');
}

export function groupIcon(key: string): string {
	if (key === 'reading') return 'book-open';
	if (key === 'finished') return 'check-circle';
	if (key === 'audio') return 'headphones';
	if (key === 'article') return 'file-text';
	if (key === 'recent7' || key === 'recent30') return 'history';
	if (key === 'ideas') return 'message-square';
	if (key === 'highlights') return 'highlighter';
	return 'book';
}

export function contentTypeLabel(contentType?: WereadBookLike['contentType']): string {
	if (contentType === 'audio') return t('weread.contentAudio');
	if (contentType === 'article') return t('weread.contentArticle');
	return t('weread.contentBook');
}

export function readingStateLabel(state?: WereadBookLike['readingState']): string {
	if (state === 'finished') return t('weread.progressFinished');
	if (state === 'reading') return t('weread.progressReading');
	return t('weread.progressNotStarted');
}
