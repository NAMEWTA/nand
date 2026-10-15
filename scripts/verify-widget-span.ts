// Retained baseline logic assertions; renderer behavior is verified against the current React components.
import { strict as assert } from 'node:assert';
import { runHomeReactChecks } from './run-home-react-checks';
import {
	ALL_TIERS,
	RATIO_SPAN,
	STACKED_FIXED_SPANS,
	buildStackedSpanSpecs,
	clampSidebarWidth,
	clampWidgetUnitHeight,
	isTieredWidgetKey,
	resolveStackedSpans,
	type StackedRatios,
} from '../src/modules/home/ui/widgets/widget-span';
import type { AlbumConfig } from '../src/modules/home/core/board/types';
const spansFor = (keys: string[], ratios: StackedRatios = {}): number[] =>
	resolveStackedSpans(buildStackedSpanSpecs(keys, ratios));
const albumCfg = (id: number, heightRatio?: AlbumConfig['heightRatio']): AlbumConfig =>
	({ id, folder: '', intervalSec: 8, recursive: true, ratio: '1:1', transition: 'fade', heightRatio }) as AlbumConfig;
// --- 1. resolveStackedSpans: the packing rules -------------------------
{
	// Preferred fits -> preferred stays (lunar 2 leaves 4; habit's default
	// two-thirds = 4 tiles the column exactly).
	assert.deepEqual(spansFor(['lunar', 'habit']), [2, 4], 'preferred tier fits the column remainder');
	// Misfit + exact tier match -> downshift fills the column.
	assert.deepEqual(spansFor(['weather', 'habit']), [4, 2], 'habit downshifts 4->2 to exactly fill after weather');
	assert.deepEqual(spansFor(['habit', 'reading']), [4, 2], 'reading downshifts 3->2 after a two-thirds habit');
	// Two halves tile one column.
	assert.deepEqual(spansFor(['reading', 'habit'], { habit: 'half' }), [3, 3], 'half + half tile one column');
	// FIXED cards never adapt: pomodoro (3) misfits the 2-row remainder and
	// starts a fresh column instead of shrinking.
	assert.deepEqual(spansFor(['weather', 'pomodoro']), [4, 3], 'fixed card misfit starts a fresh column');
	// Album participates in the downshift (full preferred, 2-row remainder).
	assert.deepEqual(
		spansFor(['weather', 'album-1'], { albums: [albumCfg(1, 'full')] }),
		[4, 2],
		'album downshifts to fill',
	);
	// Leftover-1 hole: 3+2=5 leaves 1 row; no tier equals 1, so the next
	// card (fixed OR tiered) starts a fresh column and the hole stays.
	assert.deepEqual(
		spansFor(['reading', 'lunar', 'countdown-x']),
		[3, 2, 2],
		'countdown starts a new column after a 1-row hole',
	);
	assert.deepEqual(
		spansFor(['reading', 'lunar', 'habit']),
		[3, 2, 4],
		'tiered card also refuses a 1-row remainder (fresh column, preferred kept)',
	);
	// quickActions (fixed 6) fills its column alone; the next card starts fresh.
	assert.deepEqual(spansFor(['quickActions', 'lunar']), [6, 2], 'quickActions owns a column');
	// Never grows: a third-tier card in an empty column keeps 2 (the rest
	// of the column is left for following cards).
	assert.deepEqual(spansFor(['habit'], { habit: 'third' }), [2], 'spans never grow beyond the preferred tier');
}

// --- 2. buildStackedSpanSpecs: tiers, prefixes, defaults ---------------
{
	const specs = buildStackedSpanSpecs(
		['habit', 'reading', 'album-7', 'album-8', 'countdown-x', 'anniversary-y', 'weather', 'mystery'],
		{ albums: [albumCfg(7, 'third'), albumCfg(8)] },
	);
	assert.deepEqual(
		specs.map((s) => s.preferred),
		[4, 3, 2, 6, 2, 2, 4, 6],
		'habit defaults two-thirds, reading half, album per-instance (missing -> full), prefixes 2, fixed table, unknown 6',
	);
	assert.deepEqual(
		specs.map((s) => s.allowed ?? null),
		[ALL_TIERS, ALL_TIERS, ALL_TIERS, ALL_TIERS, null, null, null, null],
		'only tiered cards carry an allowed set',
	);
	assert.equal(isTieredWidgetKey('habit'), true);
	assert.equal(isTieredWidgetKey('reading'), true);
	assert.equal(isTieredWidgetKey('album-1'), true);
	assert.equal(isTieredWidgetKey('album'), false, 'the bare order key is not a widget key');
	assert.equal(isTieredWidgetKey('weather'), false);
	assert.equal(isTieredWidgetKey('countdown-x'), false);
	// The fixed table must mirror the CSS per-type rules.
	assert.deepEqual(
		STACKED_FIXED_SPANS,
		{
			quickActions: 6,
			calendar: 6,
			weather: 4,
			pomodoro: 3,
			expense: 3,
			music: 3,
			lunar: 2,
			yearProgress: 2,
			quickCapture: 2,
			fileSearch: 2,
		},
		'STACKED_FIXED_SPANS unchanged (update styles.css together)',
	);
	assert.deepEqual(RATIO_SPAN, { full: 6, twoThirds: 4, half: 3, third: 2 });
}
// --- 5. Clamps ----------------------------------------------------------
{
	assert.equal(clampSidebarWidth(300), 300);
	assert.equal(clampSidebarWidth(50), 180, 'below the floor clamps');
	assert.equal(clampSidebarWidth(999), 420, 'above the ceiling clamps');
	assert.equal(clampSidebarWidth('x'), 220, 'dirty value falls back to the default');
	assert.equal(clampSidebarWidth(undefined), 220);
	assert.equal(clampWidgetUnitHeight(420), 420);
	assert.equal(clampWidgetUnitHeight(100), 240);
	assert.equal(clampWidgetUnitHeight(9999), 560);
	assert.equal(clampWidgetUnitHeight(null), 300);
}

runHomeReactChecks([
	'ui/widgets/widget-layout.dom.test.tsx',
	'core/board/home-grid.test.ts',
	'ui/widgets/input-widgets.dom.test.tsx',
]);
