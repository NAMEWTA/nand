// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.

/** Settings that decide how tall a list row is. */
export interface RowMetrics {
	compact: boolean;
	/** Lines the title may take (1 to 3). */
	titleRows: number;
	previewRows: number;
	showPreview: boolean;
	showThumbnail: boolean;
	showDate: boolean;
	showTags: boolean;
	showParentFolder: boolean;
}

export const NAV_ROW_HEIGHT = 32;
export const HEADER_ROW_HEIGHT = 30;
const TITLE_LINE = 20;
const PREVIEW_LINE = 16;
const META_LINE = 18;
const ROW_PADDING = 12;
const THUMBNAIL = 52;

/** Height of a note row: a pure function of the display settings so scrolling never measures. */
export function noteRowHeight(metrics: RowMetrics): number {
	if (metrics.compact) return NAV_ROW_HEIGHT;
	const preview = metrics.showPreview ? metrics.previewRows * PREVIEW_LINE : 0;
	const meta = metrics.showDate || metrics.showTags || metrics.showParentFolder ? META_LINE : 0;
	const text = TITLE_LINE * Math.max(1, Math.min(3, metrics.titleRows)) + preview + meta + ROW_PADDING;
	return Math.max(text, metrics.showThumbnail && metrics.showPreview ? THUMBNAIL + ROW_PADDING : 0);
}

/** Thumbnail edge length in px for a row of `height`. */
export function thumbnailSize(height: number): number {
	return Math.max(32, Math.min(THUMBNAIL, height - ROW_PADDING));
}
