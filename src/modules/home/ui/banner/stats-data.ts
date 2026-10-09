import { App } from 'obsidian';
import type {
	BannerCenterStat,
	BannerLeftStat,
	BannerRightStat,
	BannerStatsConfig,
} from '../../core/board/types/index';
import { getDailyNotesConfig } from '../../platform/calendar/daily-notes';
import { momentOf, nowMoment, parseStrict } from '../../../../host/obsidian/datetime';
import { t } from '../../../../shared/i18n/index';
import { homeServices } from '../../services/instances';
export const LEFT_STAT_OPTIONS: BannerLeftStat[] = [
	'totalNotes',
	'tagsCount',
	'totalLinks',
	'newThisMonth',
	'newThisWeek',
	'totalTasks',
	'doneTasks',
	'pendingTasks',
];

export const CENTER_STAT_OPTIONS: BannerCenterStat[] = ['streak', 'taskCompletion', 'connectivity', 'newThisWeek'];

export const RIGHT_STAT_OPTIONS: BannerRightStat[] = [
	'taskCompletion',
	'connectivity',
	'orphanRate',
	'avgLinksPerNote',
];

export function resolveStatsConfig(config?: BannerStatsConfig): BannerStatsConfig {
	return {
		dailyFolder: config?.dailyFolder,
		dailyFormat: config?.dailyFormat,
		streakFromDaily: config?.streakFromDaily,
		excludeFolders: config?.excludeFolders ? [...config.excludeFolders] : undefined,
		accent: config?.accent,
		blur: config?.blur,
		darkness: config?.darkness,
		showDetails: config?.showDetails ?? true,
		showLeft: config?.showLeft ?? true,
		showCenter: config?.showCenter ?? true,
		showRight: config?.showRight ?? true,
		leftStat: config?.leftStat ?? 'totalNotes',
		centerStat: config?.centerStat ?? 'streak',
		rightStats:
			config?.rightStats && config.rightStats.length > 0
				? [...config.rightStats]
				: ['taskCompletion', 'connectivity', 'avgLinksPerNote'],
		heatmapSource: config?.heatmapSource,
		heatmapHabitId: config?.heatmapHabitId,
	};
}

export const HEATMAP_DAYS = 98;

export function habitHeatmapSeries(app: App, config: BannerStatsConfig, days: number): number[] | null {
	if (config.heatmapSource !== 'habit') return null;
	const service = (homeServices.habit ?? null);
	if (!service) return null;
	const habits = service.getHabits();
	if (habits.length === 0) return null;
	const target = config.heatmapHabitId ?? 'all';
	if (target !== 'all' && !habits.some((h) => h.id === target)) return null;
	return service.getHeatmapDays(target, days);
}

export const LEFT_ICONS: Record<BannerLeftStat, string> = {
	totalNotes: 'file-text',
	tagsCount: 'hash',
	totalLinks: 'link',
	newThisMonth: 'calendar-plus',
	newThisWeek: 'calendar-check',
	totalTasks: 'list-checks',
	doneTasks: 'check-check',
	pendingTasks: 'circle-dashed',
};

export const CENTER_ICONS: Record<BannerCenterStat, string> = {
	streak: 'flame',
	taskCompletion: 'check-check',
	connectivity: 'network',
	newThisWeek: 'calendar-check',
};

export const RIGHT_ICONS: Record<BannerRightStat, string> = {
	taskCompletion: 'list-checks',
	connectivity: 'network',
	orphanRate: 'circle-slash',
	avgLinksPerNote: 'link',
};

export interface BannerStatsResult {
	totalNotes: number;
	newThisMonth: number;
	newThisWeek: number;
	tagsCount: number;
	/** Consecutive days with a daily note. Only meaningful when `hasDailySource`
	 *  is true; otherwise the daily-notes folder could not be resolved and the
	 *  streak falls back to `activeStreak` semantics (see below). */
	streak: number;
	/** True when a daily-notes source (manual folder or the core plugin) was
	 *  resolved AND yielded at least one matching note. When false, `streak`
	 *  equals `activeStreak` and the label must read "活跃天数", not "连续记录",
	 *  so the number never silently switches meaning between page loads. */
	hasDailySource: boolean;
	/** Consecutive days on which ANY markdown file was created in the vault —
	 *  the same dataset the heatmap is drawn from. Deterministic across loads. */
	activeStreak: number;
	totalLinks: number;
	orphanNotes: number;
	orphanRate: number; // 0–100
	avgLinksPerNote: number;
	connectivity: number; // 0–100
	totalTasks: number;
	doneTasks: number;
	pendingTasks: number;
	taskCompletion: number; // 0–100
	/** Notes created per day for the last HEATMAP_DAYS, oldest → today. */
	activity: number[];
}

export function computeBannerStats(app: App, config?: BannerStatsConfig): BannerStatsResult {
	// Excluded folders are matched by path prefix (case-insensitive), same
	// semantics as the calendar widget's exclusions — a checked parent covers
	// its whole subtree.
	const excludeFolders = (config?.excludeFolders ?? [])
		.map((f) => f.trim().toLowerCase())
		.filter((f) => f !== '' && f !== '/');
	const isExcluded = (path: string): boolean => {
		if (excludeFolders.length === 0) return false;
		const lower = path.toLowerCase();
		return excludeFolders.some((f) => lower === f || lower.startsWith(f + '/'));
	};
	const files = app.vault.getMarkdownFiles().filter((f) => !isExcluded(f.path));
	const now = nowMoment();
	const startOfMonth = now.clone().startOf('month').valueOf();
	const weekAgoMs = now.clone().subtract(6, 'days').startOf('day').valueOf();
	const todayStartMs = now.clone().startOf('day').valueOf();
	const heatStartMs = now
		.clone()
		.subtract(HEATMAP_DAYS - 1, 'days')
		.startOf('day')
		.valueOf();

	let totalNotes = 0;
	let newThisMonth = 0;
	let newThisWeek = 0;
	let orphanNotes = 0;
	const activity = new Array<number>(HEATMAP_DAYS).fill(0);
	const tagCounts = new Map<string, number>();
	const activityDates = new Set<string>();

	const resolved = app.metadataCache.resolvedLinks;
	const hasOutgoing = new Set<string>();
	const hasIncoming = new Set<string>();
	let totalLinks = 0;
	for (const [src, targets] of Object.entries(resolved)) {
		if (isExcluded(src)) continue;
		// Links touching excluded folders on either end do not count, so
		// connectivity/orphan stats stay consistent with the filtered file set.
		let kept = 0;
		for (const [tgt, count] of Object.entries(targets)) {
			if (isExcluded(tgt)) continue;
			hasIncoming.add(tgt);
			totalLinks += count;
			kept++;
		}
		if (kept > 0) hasOutgoing.add(src);
	}

	let totalTasks = 0;
	let doneTasks = 0;

	for (const file of files) {
		if (file.path.startsWith('.')) continue;
		totalNotes++;

		const ctime = file.stat.ctime;
		if (ctime >= startOfMonth) newThisMonth++;
		if (ctime >= weekAgoMs) newThisWeek++;
		if (ctime >= heatStartMs) {
			const dayDiff = Math.floor((todayStartMs - momentOf(ctime).startOf('day').valueOf()) / DAY_MS);
			if (dayDiff >= 0 && dayDiff < HEATMAP_DAYS) activity[HEATMAP_DAYS - 1 - dayDiff]! += 1;
		}
		activityDates.add(momentOf(ctime).format('YYYY-MM-DD'));

		if (!hasOutgoing.has(file.path) && !hasIncoming.has(file.path)) orphanNotes++;

		const cache = app.metadataCache.getFileCache(file);
		const fmTags: unknown = cache?.frontmatter?.tags;
		const addTag = (raw: unknown): void => {
			if (raw == null) return;
			if (Array.isArray(raw)) {
				for (const tg of raw) addTag(tg);
			} else if (typeof raw === 'string' || typeof raw === 'number') {
				const tag = String(raw).replace(/^#/, '').trim();
				if (tag) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
			}
		};
		addTag(fmTags);
		if (cache?.tags) {
			for (const tg of cache.tags) {
				const tag = tg.tag.replace(/^#/, '').trim();
				if (tag) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
			}
		}

		if (cache?.listItems) {
			for (const li of cache.listItems) {
				if (li.task === undefined) continue;
				totalTasks++;
				if (li.task === 'x' || li.task === 'X') doneTasks++;
			}
		}
	}

	const manual = (config?.dailyFolder ?? '').trim();
	const dailyCfg = manual
		? { folder: manual, format: config?.dailyFormat || 'YYYY-MM-DD' }
		: getDailyNotesConfig(app);

	// `activeStreak` is always derived from the same file-creation set the
	// heatmap uses, so it is stable across loads. It is the ONLY streak value
	// when no daily-notes source is available.
	const activeStreak = computeDateStreak(activityDates);

	// The "real" streak counts daily notes only. We must NOT silently fall back
	// to `activityDates` when the daily source is empty/unavailable — that was
	// the root cause of the number flipping meaning between page loads (a small
	// daily-note streak one load, a large all-vault streak the next). Instead
	// we record whether a daily source was usable; the renderer swaps the LABEL
	// (连续记录 vs 活跃天数) so the number's meaning is always unambiguous.
	// `streakFromDaily: false` opts out of the daily source entirely: the
	// streak then counts any note creation (the 活跃天数 semantics).
	let streak = 0;
	let hasDailySource = false;
	if (config?.streakFromDaily !== false && dailyCfg) {
		const dailyDates = collectDailyNoteDates(app, dailyCfg.folder, dailyCfg.format);
		if (dailyDates.size > 0) {
			streak = computeDateStreak(dailyDates);
			hasDailySource = true;
		}
	}
	if (!hasDailySource) streak = activeStreak;

	return {
		totalNotes,
		newThisMonth,
		newThisWeek,
		tagsCount: tagCounts.size,
		streak,
		hasDailySource,
		activeStreak,
		totalLinks,
		orphanNotes,
		orphanRate: totalNotes > 0 ? Math.round((orphanNotes / totalNotes) * 100) : 0,
		avgLinksPerNote: totalNotes > 0 ? totalLinks / totalNotes : 0,
		connectivity: totalNotes > 0 ? Math.round(((totalNotes - orphanNotes) / totalNotes) * 100) : 0,
		totalTasks,
		doneTasks,
		pendingTasks: totalTasks - doneTasks,
		taskCompletion: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
		activity,
	};
}

export function collectDailyNoteDates(app: App, folder: string, format: string): Set<string> {
	const dates = new Set<string>();
	const prefix = folder ? `${folder}/` : '';
	for (const file of app.vault.getMarkdownFiles()) {
		if (prefix && !file.path.toLowerCase().startsWith(prefix.toLowerCase())) continue;
		if (prefix && file.path.slice(prefix.length).includes('/')) continue;
		const m = parseStrict(file.basename, format);
		if (m.isValid()) dates.add(m.format('YYYY-MM-DD'));
	}
	return dates;
}

export function computeDateStreak(dates: Set<string>): number {
	if (dates.size === 0) return 0;
	let cursor = nowMoment().startOf('day');
	if (!dates.has(cursor.format('YYYY-MM-DD'))) cursor = cursor.subtract(1, 'day');
	let streak = 0;
	while (dates.has(cursor.format('YYYY-MM-DD'))) {
		streak++;
		cursor = cursor.subtract(1, 'day');
	}
	return streak;
}

export function formatInt(n: number): string {
	return n.toLocaleString();
}

export function habitCenterSub(app: App, config: BannerStatsConfig): string {
	const service = (homeServices.habit ?? null);
	if (!service) return '';
	const habits = service.getHabits();
	const target = config.heatmapHabitId ?? 'all';
	if (target === 'all') {
		const today = nowMoment().format('YYYY-MM-DD');
		const done = service.getDoneOn(today).length;
		return t('habit.centerSubToday', { done: String(done), total: String(habits.length) });
	}
	return t('habit.centerSubRate', { rate: String(service.getRate30(target)) });
}

export function leftValue(stat: BannerLeftStat, r: BannerStatsResult): number {
	switch (stat) {
		case 'totalNotes':
			return r.totalNotes;
		case 'tagsCount':
			return r.tagsCount;
		case 'totalLinks':
			return r.totalLinks;
		case 'newThisMonth':
			return r.newThisMonth;
		case 'newThisWeek':
			return r.newThisWeek;
		case 'totalTasks':
			return r.totalTasks;
		case 'doneTasks':
			return r.doneTasks;
		case 'pendingTasks':
			return r.pendingTasks;
	}
}

export function centerValue(
	stat: BannerCenterStat,
	r: BannerStatsResult,
): { text: number; format: (n: number) => string } {
	switch (stat) {
		case 'streak':
			return { text: r.streak, format: (n) => `${n}${t('banner.stats.dayUnit')}` };
		case 'taskCompletion':
			return { text: r.taskCompletion, format: (n) => `${n}%` };
		case 'connectivity':
			return { text: r.connectivity, format: (n) => `${n}%` };
		case 'newThisWeek':
			return { text: r.newThisWeek, format: formatInt };
	}
}

export function centerSub(stat: BannerCenterStat, r: BannerStatsResult): string {
	switch (stat) {
		case 'streak':
			return t(r.hasDailySource ? 'banner.stats.centerSubStreak' : 'banner.stats.centerSubActive', {
				week: r.newThisWeek,
				month: r.newThisMonth,
			});
		case 'taskCompletion':
			return t('banner.stats.centerSubTask', { done: r.doneTasks, total: r.totalTasks });
		case 'connectivity':
			return t('banner.stats.centerSubConn', { n: r.orphanNotes });
		case 'newThisWeek':
			return t('banner.stats.centerSubWeek', { n: r.streak });
	}
}

export function rightValue(stat: BannerRightStat, r: BannerStatsResult): { value: string; pct: number } {
	switch (stat) {
		case 'taskCompletion':
			return { value: `${r.taskCompletion}%`, pct: r.taskCompletion };
		case 'connectivity':
			return { value: `${r.connectivity}%`, pct: r.connectivity };
		case 'orphanRate':
			return { value: `${r.orphanRate}%`, pct: r.orphanRate };
		case 'avgLinksPerNote':
			return {
				value: r.avgLinksPerNote.toFixed(1),
				pct: Math.min(100, Math.round((r.avgLinksPerNote / 3) * 100)),
			};
	}
}

export function heatLevel(v: number, max: number): number {
	if (v <= 0) return 0;
	const ratio = v / max;
	if (ratio <= 0.25) return 1;
	if (ratio <= 0.5) return 2;
	if (ratio <= 0.75) return 3;
	return 4;
}

export const DEFAULT_STATS_CONFIG: BannerStatsConfig = {
	showDetails: true,
	leftStat: 'totalNotes',
	centerStat: 'streak',
	rightStats: ['taskCompletion', 'connectivity', 'avgLinksPerNote'],
};

export const DAY_MS = 24 * 60 * 60 * 1000;
