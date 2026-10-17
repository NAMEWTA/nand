import type { CellSize } from './widget-catalog';
import type { HomeWidgetCategory, HomeWidgetTier } from './widget-tiers';

type Sizes = Partial<Record<HomeWidgetTier, CellSize>>;
export interface BuiltinWidgetSpec {
	key: string;
	icon: string;
	category: HomeWidgetCategory;
	sizes: Sizes;
	defaultTier: HomeWidgetTier;
	minSize: CellSize;
	multiple?: boolean;
	/** Board content section this kind creates (notes, projects, ...). */
	section?: string;
}

const cell = (w: number, h: number): CellSize => ({ w, h });
const small = cell(2, 6);
const content = cell(3, 12);

/** The one size table of every built-in widget (w columns of 12, h fine rows of 10px). */
export const BUILTIN_WIDGETS: readonly BuiltinWidgetSpec[] = [
	{
		key: 'banner',
		icon: 'image',
		category: 'overview',
		sizes: { S: cell(12, 8), M: cell(12, 12), L: cell(12, 16), XL: cell(12, 24) },
		defaultTier: 'M',
		minSize: cell(4, 6),
	},
	{
		key: 'clock',
		icon: 'clock',
		category: 'time',
		sizes: { S: cell(3, 10), M: cell(4, 12), L: cell(6, 16) },
		defaultTier: 'M',
		minSize: small,
	},
	{
		key: 'calendar',
		icon: 'calendar',
		category: 'time',
		sizes: { S: cell(4, 28), M: cell(4, 50), L: cell(6, 52), XL: cell(8, 60) },
		defaultTier: 'M',
		minSize: cell(3, 16),
	},
	{
		key: 'lunar',
		icon: 'moon',
		category: 'time',
		sizes: { S: cell(3, 10), M: cell(3, 16), L: cell(4, 24) },
		defaultTier: 'M',
		minSize: small,
	},
	{
		key: 'year-progress',
		icon: 'calendar-range',
		category: 'time',
		sizes: { S: cell(3, 10), M: cell(4, 16), L: cell(6, 20) },
		defaultTier: 'M',
		minSize: small,
	},
	{
		key: 'countdown',
		icon: 'timer',
		category: 'time',
		sizes: { S: cell(3, 15), M: cell(3, 18), L: cell(4, 24) },
		defaultTier: 'M',
		minSize: small,
		multiple: true,
	},
	{
		key: 'anniversary',
		icon: 'cake',
		category: 'time',
		sizes: { S: cell(3, 10), M: cell(3, 16), L: cell(4, 24) },
		defaultTier: 'M',
		minSize: small,
		multiple: true,
	},
	{
		key: 'pomodoro',
		icon: 'timer-reset',
		category: 'productivity',
		sizes: { S: cell(3, 16), M: cell(3, 24), L: cell(4, 32) },
		defaultTier: 'M',
		minSize: cell(2, 12),
	},
	{
		key: 'habit',
		icon: 'check-circle',
		category: 'record',
		sizes: { S: cell(3, 20), M: cell(4, 32), L: cell(6, 40), XL: cell(6, 56) },
		defaultTier: 'M',
		minSize: cell(3, 12),
	},
	{
		key: 'expense',
		icon: 'wallet',
		category: 'record',
		sizes: { S: cell(3, 16), M: cell(4, 24), L: cell(6, 32), XL: cell(6, 44) },
		defaultTier: 'M',
		minSize: cell(3, 12),
	},
	{
		key: 'reading',
		icon: 'book-open',
		category: 'record',
		sizes: { S: cell(3, 16), M: cell(4, 24), L: cell(6, 32) },
		defaultTier: 'M',
		minSize: cell(3, 12),
	},
	{
		key: 'weather',
		icon: 'cloud-sun',
		category: 'overview',
		sizes: { S: cell(3, 16), M: cell(3, 24), L: cell(4, 32) },
		defaultTier: 'M',
		minSize: cell(2, 12),
	},
	{
		key: 'usage',
		icon: 'gauge',
		category: 'agent',
		sizes: { S: cell(3, 10), M: cell(4, 22), L: cell(6, 30), XL: cell(6, 44) },
		defaultTier: 'M',
		minSize: cell(2, 8),
	},
	{
		key: 'shortcuts',
		icon: 'command',
		category: 'tools',
		sizes: { S: cell(4, 16), M: cell(4, 24), L: cell(6, 32), XL: cell(8, 44) },
		defaultTier: 'M',
		minSize: cell(2, 8),
	},
	{
		key: 'quick-actions',
		icon: 'zap',
		category: 'tools',
		sizes: { S: cell(4, 16), M: cell(4, 28), L: cell(6, 40), XL: cell(8, 48) },
		defaultTier: 'M',
		minSize: cell(2, 10),
	},
	{
		key: 'skills',
		icon: 'sparkles',
		category: 'agent',
		sizes: { S: cell(3, 10), M: cell(4, 20), L: cell(6, 28) },
		defaultTier: 'M',
		minSize: small,
	},
	{
		key: 'quickCapture',
		icon: 'pencil',
		category: 'tools',
		sizes: { S: cell(3, 8), M: cell(6, 8), L: cell(8, 12) },
		defaultTier: 'M',
		minSize: cell(2, 6),
	},
	{
		key: 'fileSearch',
		icon: 'search',
		category: 'tools',
		sizes: { S: cell(3, 8), M: cell(4, 12), L: cell(6, 24) },
		defaultTier: 'M',
		minSize: cell(2, 6),
	},
	{
		key: 'recent',
		icon: 'history',
		category: 'content',
		sizes: { S: cell(3, 20), M: cell(4, 30), L: cell(6, 40) },
		defaultTier: 'M',
		minSize: cell(3, 12),
	},
	{
		key: 'nav-recent',
		icon: 'history',
		category: 'content',
		sizes: { S: cell(3, 14), M: cell(4, 24), L: cell(6, 32) },
		defaultTier: 'M',
		minSize: cell(2, 10),
	},
	{
		key: 'nav-shortcuts',
		icon: 'bookmark',
		category: 'content',
		sizes: { S: cell(3, 14), M: cell(4, 24), L: cell(6, 32) },
		defaultTier: 'M',
		minSize: cell(2, 10),
	},
	{
		key: 'music',
		icon: 'music',
		category: 'media',
		sizes: { S: cell(3, 15), M: cell(4, 24), L: cell(6, 32) },
		defaultTier: 'M',
		minSize: cell(3, 12),
		multiple: false,
	},
	{
		key: 'album',
		icon: 'image',
		category: 'media',
		sizes: { S: cell(3, 20), M: cell(4, 32), L: cell(6, 44), XL: cell(8, 60) },
		defaultTier: 'M',
		minSize: cell(2, 12),
		multiple: true,
	},
];

const sectionSizes: Sizes = { S: cell(4, 30), M: cell(6, 50), L: cell(8, 70), XL: cell(12, 80) };
const wideSizes: Sizes = { S: cell(6, 40), M: cell(8, 60), L: cell(12, 60), XL: cell(12, 90) };
const section = (
	type: string,
	icon: string,
	category: HomeWidgetCategory,
	sizes: Sizes,
	defaultTier: HomeWidgetTier = 'M',
): BuiltinWidgetSpec => ({
	key: `section-${type}`,
	icon,
	category,
	sizes,
	defaultTier,
	minSize: content,
	multiple: true,
	section: type,
});

/** Board content sections as widget kinds: adding one creates a column of that type. */
export const SECTION_WIDGETS: readonly BuiltinWidgetSpec[] = [
	section('memo', 'sticky-note', 'productivity', sectionSizes),
	section('todo', 'check-square', 'productivity', sectionSizes),
	section('sticky', 'sticky-note', 'content', sectionSizes),
	section('projects', 'notebook', 'content', sectionSizes),
	section('library', 'database', 'content', wideSizes),
	section('folder', 'folder', 'content', wideSizes),
	section('dataview', 'table', 'content', wideSizes, 'L'),
	section('pm', 'kanban', 'productivity', wideSizes, 'L'),
	section('pipeline', 'workflow', 'productivity', wideSizes, 'L'),
	section('skills', 'sparkles', 'agent', sectionSizes),
	section('calendar', 'calendar', 'time', wideSizes),
	section('rss', 'rss', 'media', wideSizes),
	section('images', 'image', 'media', wideSizes),
	section('videos', 'video', 'media', wideSizes),
	section('web', 'globe', 'media', wideSizes),
	section('weread', 'book-open', 'media', wideSizes),
	section('ticktick', 'check-square', 'productivity', wideSizes),
];

const SECTION_BY_TYPE = new Map(SECTION_WIDGETS.map((spec) => [spec.section!, spec]));

/** Starting size of a content section on the canvas. */
export function sectionDefaultSize(type: string | undefined, half = false): CellSize & { minW: number; minH: number } {
	const spec = (type && SECTION_BY_TYPE.get(type)) || SECTION_BY_TYPE.get('sticky')!;
	const size = spec.sizes[spec.defaultTier]!;
	return { w: half ? Math.min(size.w, 6) : size.w, h: size.h, minW: spec.minSize.w, minH: spec.minSize.h };
}
