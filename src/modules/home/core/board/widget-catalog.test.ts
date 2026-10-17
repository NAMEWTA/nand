import { expect, test } from 'vitest';
import type { HomeWidgetKind } from '../../api';
import { BUILTIN_WIDGETS, SECTION_WIDGETS } from './widget-table';
import {
	catalogCategories,
	defaultCellSize,
	exactTier,
	filterCatalog,
	nearestTier,
	supportedTiers,
	tierSize,
	type CatalogEntry,
} from './widget-catalog';
import { HOME_WIDGET_CATEGORIES } from './widget-tiers';

const kind = (key: string, category: HomeWidgetKind['category'] = 'time'): HomeWidgetKind => ({
	key,
	titleKey: key,
	icon: 'x',
	category,
	defaultTier: 'M',
	minSize: { w: 2, h: 6 },
	sizes: { S: { w: 3, h: 10 }, M: { w: 4, h: 20 }, XL: { w: 8, h: 40 } },
	instances: () => [{ id: 'default' }],
	render: () => undefined,
});

test('every built-in declares its tiers once, with a default among them and a minimum that fits', () => {
	const keys = new Set<string>();
	for (const spec of [...BUILTIN_WIDGETS, ...SECTION_WIDGETS]) {
		expect(keys.has(spec.key), spec.key).toBe(false);
		keys.add(spec.key);
		expect(spec.sizes[spec.defaultTier], spec.key).toBeDefined();
		for (const cell of Object.values(spec.sizes)) {
			expect(cell.w).toBeGreaterThanOrEqual(spec.minSize.w);
			expect(cell.h).toBeGreaterThanOrEqual(spec.minSize.h);
			expect(cell.w).toBeLessThanOrEqual(12);
			expect(cell.h).toBeLessThanOrEqual(240);
		}
	}
});

test('tiers resolve to grid cells, in order, and an unsupported tier falls back to the default', () => {
	const k = kind('calendar');
	expect(supportedTiers(k)).toEqual(['S', 'M', 'XL']);
	expect(tierSize(k, 'XL')).toEqual({ w: 8, h: 40 });
	expect(tierSize(k, 'L')).toEqual({ w: 4, h: 20 });
	expect(defaultCellSize(k)).toEqual({ w: 4, h: 20 });
});

test('a free-form size maps to the nearest tier and only exact cells count as a tier', () => {
	const k = kind('calendar');
	expect(nearestTier(k, { w: 3, h: 12 })).toBe('S');
	expect(nearestTier(k, { w: 7, h: 36 })).toBe('XL');
	expect(exactTier(k, { w: 4, h: 20 })).toBe('M');
	expect(exactTier(k, { w: 4, h: 21 })).toBeUndefined();
});

test('the add panel filters by text and category and lists only categories that still have entries', () => {
	const entries: CatalogEntry[] = [
		{ module: 'home', kind: kind('calendar', 'time'), title: 'Calendar' },
		{ module: 'home', kind: kind('pomodoro', 'productivity'), title: 'Pomodoro' },
		{ module: 'home', kind: kind('album', 'media'), title: 'Photo album' },
	];
	expect(filterCatalog(entries, 'photo').map((e) => e.kind.key)).toEqual(['album']);
	expect(filterCatalog(entries, ' CAL ').map((e) => e.kind.key)).toEqual(['calendar']);
	expect(filterCatalog(entries, '', 'productivity').map((e) => e.kind.key)).toEqual(['pomodoro']);
	expect(catalogCategories(filterCatalog(entries, 'o'), HOME_WIDGET_CATEGORIES)).toEqual(['productivity', 'media']);
	expect(catalogCategories(filterCatalog(entries, 'photo'), HOME_WIDGET_CATEGORIES)).toEqual(['media']);
});
