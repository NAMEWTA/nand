import type { BannerData } from '../types/model';

export const KNOWN_METADATA_KEYS = new Set([
	'id',
	'link',
	'progress',
	'due',
	'streak',
	'type',
	'color',
	'cover',
	'width',
	'size',
	'lat',
	'lon',
	'city',
	'track',
	'days',
	'cols',
	'rows',
	'gcol',
	'grow',
	'noteStyle',
	'openIn',
]);

export const SECTION_TYPES = new Set([
	'memo',
	'todo',
	'projects',
	'notes',
	'dashboard',
	'library',
	'folder',
	'images',
	'videos',
	'alltasks',
	'calendar',
	'dataview',
	'weread',
	'sticky',
	'web',
]);

export function normalizeHexColor(value?: string): string {
	if (!value) return '';
	const trimmed = value.trim();
	return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

export const REMINDER_REGEX = /\s*⏰\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*$/;

export const COLLAPSED_REGEX = /\s*<!--collapsed-->\s*$/;

export const DOC_LINE_REGEX = /^(\s*)(?:- )?\[\[((?:[^\]\n]|\](?!\]))+?)]](\s*<!--collapsed-->\s*)?$/;

export const DEFAULT_BANNER: BannerData = {
	quote: 'The mind is everything. What you think you become.',
	author: 'Buddha',
	// Didot (cross-platform stack, same value the font dropdown stores) as the
	// out-of-box quote face — matches the author's own vault.
	quoteFont: 'Didot,"Bodoni MT",Georgia,serif',
	// No remote images by default: a new board makes no network requests; the banner uses the theme gradient.
	image: '',
	images: [],
};

export const DEFAULT_COLUMNS = [
	{ name: 'Memo', color: '#f59e0b', sectionType: 'memo' },
	{ name: 'Todo', color: '#6366f1', sectionType: 'todo' },
	{ name: 'Projects', color: '#10b981', sectionType: 'projects' },
	{ name: 'Library', color: '#8b5cf6', sectionType: 'projects' },
];
