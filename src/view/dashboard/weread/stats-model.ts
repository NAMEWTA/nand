import type { WereadStatItem } from '../../../core/dashboard/types/index';
import type { WereadReadingState } from '../../../core/weread/weread-shelf-model';
import { shelfStateFor } from '../../../core/weread/weread-shelf-model';
import type { WereadProgressStore } from '../../../platform/obsidian/weread/weread-progress-store';
import type { WereadClient, WereadReadStats, WereadStatMode } from '../../../platform/obsidian/weread/weread-service';

/**
 * Weread "阅读统计" widget: period toggle + KPIs + reading trend (with
 * streak badges) + top-read list + preferred-category bars.
 *
 * All data comes from one /readdata/detail call per mode (cached 60s per mode
 * by the shared client). Extended fields are threshold-gated server-side, so
 * every section renders only when its data exists and KPI slots dash out.
 *
 * The selected period belongs to each mounted stats panel and survives data
 * refreshes without leaking into other dashboard instances.
 *
 * Blocks (KPI overview, trend, top read, preferred categories) render in the
 * user's configured order, two per row, and can be hidden per widget
 * (WereadWidget.statsItems, managed in the config modal).
 */

export const MODES: Array<{ mode: WereadStatMode; labelKey: string }> = [
	{ mode: 'weekly', labelKey: 'weread.statsWeekly' },
	{ mode: 'monthly', labelKey: 'weread.statsMonthly' },
	{ mode: 'annually', labelKey: 'weread.statsAnnually' },
	{ mode: 'overall', labelKey: 'weread.statsOverall' },
];

export const DEFAULT_MODE: WereadStatMode = 'overall';

/** Every known block id — the validity whitelist for stored configs, so a
 *  block can be non-default (opt-in) without becoming unloadable. */
export const ALL_STAT_ITEMS: readonly WereadStatItem[] = ['kpi', 'trend', 'topRead', 'preferCategory'];

/** Display order used when a widget has no statsItems yet: overview, most
 *  read, trend — preferCategory stays opt-in via the config modal. */
export const DEFAULT_STAT_ITEMS: readonly WereadStatItem[] = ['kpi', 'topRead', 'trend'];

export const STAT_ITEM_LABEL_KEYS: Record<WereadStatItem, string> = {
	kpi: 'weread.statsItemKpi',
	trend: 'weread.trendTitle',
	topRead: 'weread.topRead',
	preferCategory: 'weread.preferCategory',
};

/** Stored list -> render list: drop unknown ids, keep order, default = all
 *  default blocks. */
export function normalizeStatItems(items: WereadStatItem[] | undefined): WereadStatItem[] {
	if (!items || items.length === 0) return [...DEFAULT_STAT_ITEMS];
	const valid = items.filter((item) => ALL_STAT_ITEMS.includes(item));
	return valid.length > 0 ? [...new Set(valid)] : [...DEFAULT_STAT_ITEMS];
}

/** Everything the KPI panel shows beyond the /readdata/detail payload itself. */
export interface KpiExtras {
	/** Shelf distribution for the donut; null hides the zone entirely. */
	shelfCounts: { finished: number; reading: number; notStarted: number; total: number } | null;
	/** Daily buckets merged from every source we have (current mode's daily
	 *  series + this year's and last year's annually dailyReadTimes), feeding
	 *  the rolling 365-day heatmap. */
	yearBuckets: Array<{ ts: number; seconds: number }>;
}

/**
 * Secondary data for the KPI panel. Every piece degrades on failure (donut
 * hides, heatmap dashes out) — a rate-limited or missing side source must
 * never blank the primary stats. The extra fetches reuse the shared client's
 * 60s per-mode cache, so they are free while toggling.
 */
export async function buildKpiExtras(
	client: WereadClient,
	store: WereadProgressStore,
	stats: WereadReadStats,
): Promise<KpiExtras> {
	// Shelf distribution — shelf sync + persisted progress overlay only, no
	// getprogress budget (the shelf widget's enrichment already paid for it).
	let shelfCounts: KpiExtras['shelfCounts'] = null;
	try {
		await store.load();
		const shelf = await client.fetchShelf();
		const counts = { finished: 0, reading: 0, notStarted: 0, total: shelf.length };
		for (const book of shelf) {
			counts[shelfStateFor(book, store.entry(book.bookId))]++;
		}
		if (counts.total > 0) shelfCounts = counts;
	} catch {
		// shelf unavailable (rate limit, offline) — donut hides
	}

	// Rolling 365-day daily series: union of the current mode's daily buckets
	// (weekly/monthly readTimes, annually dailyReadTimes) with the annually
	// daily detail of this year and last — the window reaching back into the
	// previous year is what the mode payloads alone cannot cover.
	const byDay = new Map<string, { ts: number; seconds: number }>();
	const addSeries = (series: ReadonlyArray<{ ts: number; seconds: number }>): void => {
		for (const b of series) {
			const d = new Date(b.ts);
			byDay.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, {
				ts: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
				seconds: b.seconds,
			});
		}
	};
	if (stats.mode === 'weekly' || stats.mode === 'monthly') addSeries(stats.readTimes);
	if (stats.dailyReadTimes.length > 0) addSeries(stats.dailyReadTimes);
	try {
		addSeries((await client.fetchReadStats('annually')).dailyReadTimes);
	} catch {
		// heatmap falls back to what we already have
	}
	try {
		addSeries((await client.fetchReadStats('annually', Date.now() - 365 * 86_400_000)).dailyReadTimes);
	} catch {
		// same
	}

	return {
		shelfCounts,
		yearBuckets: [...byDay.values()].sort((a, b) => a.ts - b.ts),
	};
}

/** Intensity level 0-4 for one bucket's seconds (banner-heatmap thresholds). */
export function heatLevel(seconds: number): number {
	if (seconds >= 3600) return 4;
	if (seconds >= 1800) return 3;
	if (seconds >= 60) return 2;
	if (seconds > 0) return 1;
	return 0;
}

export const DONUT_ORDER: Array<{ state: WereadReadingState; labelKey: string }> = [
	{ state: 'finished', labelKey: 'weread.progressFinished' },
	{ state: 'reading', labelKey: 'weread.progressReading' },
	{ state: 'notStarted', labelKey: 'weread.progressNotStarted' },
];
