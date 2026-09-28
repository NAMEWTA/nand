import { Fragment } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';
import type { WereadWidget } from '../../../core/dashboard/types';
import type { WereadProgressStore } from '../../../platform/obsidian/weread/weread-progress-store';
import {
	bucketLabel,
	buildHeatmapCells,
	computeReadStreaks,
	formatReadTime,
	wereadErrorMessage,
	type WereadClient,
	type WereadReadStats,
	type WereadStatMode,
} from '../../../platform/obsidian/weread/weread-service';
import { t } from '../../../shared/i18n';
import {
	DEFAULT_MODE,
	DONUT_ORDER,
	MODES,
	buildKpiExtras,
	heatLevel,
	normalizeStatItems,
	type KpiExtras,
} from './stats-model';
export function WereadHint({ title, description }: { title: string; description?: string }) {
	return (
		<div class="dashboard-weread-hint">
			<div class="dashboard-weread-hint-title">{title}</div>
			{description && <div class="dashboard-weread-hint-desc">{description}</div>}
		</div>
	);
}
export function WereadStats({
	client,
	store,
	widget,
	revision,
}: {
	client: WereadClient;
	store: WereadProgressStore;
	widget: WereadWidget;
	revision: number;
}) {
	const [mode, setMode] = useState<WereadStatMode>(DEFAULT_MODE),
		[data, setData] = useState<{ stats: WereadReadStats; extras: KpiExtras } | null>(null),
		[error, setError] = useState('');
	useLayoutEffect(() => {
		let active = true;
		setData(null);
		setError('');
		void (async () => {
			try {
				const stats = await client.fetchReadStats(mode);
				const extras = await buildKpiExtras(client, store, stats);
				if (active) setData({ stats, extras });
			} catch (error) {
				if (active) setError(wereadErrorMessage(error));
			}
		})();
		return () => {
			active = false;
		};
	}, [client, store, mode, revision]);
	return (
		<div class="dashboard-weread-stats-wrap">
			<div class="dashboard-weread-stats-toggle">
				{MODES.map((entry) => (
					<button
						key={entry.mode}
						class={`dashboard-weread-stats-toggle-btn${mode === entry.mode ? ' active' : ''}`}
						aria-pressed={mode === entry.mode}
						onClick={() => setMode(entry.mode)}
					>
						<span>{t(entry.labelKey)}</span>
					</button>
				))}
			</div>
			<div class="dashboard-weread-stats-body">
				{error ? (
					<WereadHint title={t('weread.loadFailed')} description={error} />
				) : !data ? (
					<WereadHint title={t('weread.loading')} />
				) : (
					normalizeStatItems(widget.statsItems).map((item) => (
						<div
							key={item}
							class={`dashboard-weread-stats-block${item === 'kpi' ? ' dashboard-weread-stats-block--wide' : ''}`}
						>
							{item === 'kpi' ? (
								<Kpi stats={data.stats} extras={data.extras} />
							) : item === 'trend' ? (
								<Trend stats={data.stats} />
							) : item === 'topRead' ? (
								<TopRead stats={data.stats} />
							) : (
								<Categories stats={data.stats} />
							)}
						</div>
					))
				)}
			</div>
		</div>
	);
}
function Kpi({ stats, extras }: { stats: WereadReadStats; extras: KpiExtras }) {
	const cells = extras.yearBuckets.length ? buildHeatmapCells(extras.yearBuckets) : [],
		counts = extras.shelfCounts,
		circumference = 2 * Math.PI * 46.5;
	let offset = 0;
	return (
		<div class="dashboard-weread-stat-panel">
			{counts && (
				<div class="dashboard-weread-stat-panel-shelf">
					<div class="dashboard-weread-stat-label">{t('weread.shelfStates')}</div>
					<div class="dashboard-weread-donut-wrap">
						<svg class="dashboard-weread-donut-svg" viewBox="0 0 108 108" width="108" height="108">
							{DONUT_ORDER.map(({ state }) => {
								const n = counts[state];
								if (n <= 0) return null;
								const length = (n / Math.max(1, counts.total)) * circumference,
									segment = Math.max(0.5, length - 1.5),
									start = offset;
								offset += length;
								return (
									<circle
										key={state}
										class={`dashboard-weread-donut-seg--${state}`}
										cx="54"
										cy="54"
										r="46.5"
										fill="none"
										stroke-width="13"
										stroke-dasharray={`${segment} ${circumference - segment}`}
										stroke-dashoffset={-start}
										transform="rotate(-90 54 54)"
									/>
								);
							})}
						</svg>
						<div class="dashboard-weread-donut-center">
							<div class="dashboard-weread-donut-total">{counts.total}</div>
							<div class="dashboard-weread-donut-unit">{t('weread.shelfTotalUnit')}</div>
						</div>
					</div>
					<div class="dashboard-weread-legend">
						{DONUT_ORDER.map(({ state, labelKey }) => (
							<div key={state} class="dashboard-weread-legend-item">
								<div class={`dashboard-weread-legend-dot--${state}`} />
								<span class="dashboard-weread-legend-label">{t(labelKey)}</span>
								<span class="dashboard-weread-legend-count">{counts[state]}</span>
							</div>
						))}
					</div>
				</div>
			)}
			<div class="dashboard-weread-stat-panel-mid">
				<div class="dashboard-weread-stat-label">{t('weread.readDays')}</div>
				{cells.length ? (
					<div
						class="dashboard-weread-heatmap"
						style={{ gridTemplateColumns: `repeat(${Math.ceil(cells.length / 7)}, minmax(0,1fr))` }}
					>
						{cells.map((cell) => {
							const d = new Date(cell.ts),
								tip = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} · ${formatReadTime(cell.seconds)}`;
							return (
								<div
									key={cell.ts}
									class={`dashboard-weread-heatmap-cell ${cell.inWindow ? `dashboard-weread-heatmap-cell--l${heatLevel(cell.seconds)}${cell.isToday ? ' dashboard-weread-heatmap-cell--today' : ''}` : 'dashboard-weread-heatmap-cell--blank'}`}
									title={tip}
									aria-label={tip}
								/>
							);
						})}
					</div>
				) : (
					<div class="dashboard-weread-kpi-caption-extra">—</div>
				)}
				<div class="dashboard-weread-stat-value">
					{cells.filter((c) => c.inWindow && c.seconds >= 60).length}
				</div>
				<div class="dashboard-weread-kpi-caption-extra">{t('weread.last365')}</div>
			</div>
			<div class="dashboard-weread-stat-panel-right">
				{[
					{ label: 'weread.totalTime', value: formatReadTime(stats.totalReadTime) },
					{ label: 'weread.statNotes', value: stats.readStat.find((s) => s.stat === '笔记')?.counts ?? '—' },
				].map((entry) => (
					<div key={entry.label} class="dashboard-weread-stat-panel-cell">
						<div class="dashboard-weread-stat-label">{t(entry.label)}</div>
						<div class="dashboard-weread-stat-value">{entry.value}</div>
					</div>
				))}
			</div>
		</div>
	);
}
function Trend({ stats }: { stats: WereadReadStats }) {
	if (!stats.readTimes.length) return null;
	const buckets = stats.readTimes,
		max = Math.max(...buckets.map((b) => b.seconds), 1),
		step = 520 / buckets.length,
		width = Math.max(2, Math.min(18, step * 0.6)),
		every = buckets.length <= 14 ? 1 : Math.ceil(buckets.length / 12),
		streak = computeReadStreaks(buckets);
	return (
		<div class="dashboard-weread-stats-section">
			<div class="dashboard-weread-stats-section-head">
				<div class="dashboard-weread-stats-section-title">{t('weread.trendTitle')}</div>
				{(stats.mode === 'weekly' || stats.mode === 'monthly') && streak.longest > 0 && (
					<div class="dashboard-weread-streak">
						{t('weread.streakBadge', { cur: String(streak.current), long: String(streak.longest) })}
					</div>
				)}
			</div>
			<svg class="dashboard-weread-trend-svg" viewBox="0 0 520 126" width="100%" height="126">
				{buckets.map((b, i) => {
					const height = Math.round((b.seconds / max) * 100);
					return (
						<Fragment key={b.ts}>
							<rect
								class="dashboard-weread-trend-bar"
								x={i * step + (step - width) / 2}
								y={110 - height}
								width={width}
								height={Math.max(b.seconds > 0 ? 2 : 0, height)}
								rx="2"
							>
								<title>
									{bucketLabel(b.ts, stats.mode)} · {formatReadTime(b.seconds)}
								</title>
							</rect>
							{i % every === 0 && (
								<text
									class="dashboard-weread-trend-tick"
									x={i * step + step / 2}
									y="122"
									text-anchor="middle"
								>
									{bucketLabel(b.ts, stats.mode)}
								</text>
							)}
						</Fragment>
					);
				})}
			</svg>
		</div>
	);
}
function TopRead({ stats }: { stats: WereadReadStats }) {
	return !stats.readLongest.length ? null : (
		<div class="dashboard-weread-stats-section">
			<div class="dashboard-weread-stats-section-title">{t('weread.topRead')}</div>
			<div class="dashboard-weread-topread">
				{stats.readLongest.slice(0, 3).map((item, i) => (
					<div key={i} class="dashboard-weread-topread-row">
						<div class="dashboard-weread-topread-meta">
							<div class="dashboard-weread-topread-title">{item.title}</div>
							{item.author && <div class="dashboard-weread-topread-author">{item.author}</div>}
						</div>
						<div class="dashboard-weread-topread-time">{formatReadTime(item.readTime)}</div>
					</div>
				))}
			</div>
		</div>
	);
}
function Categories({ stats }: { stats: WereadReadStats }) {
	const cats = stats.preferCategory.slice(0, 5),
		maxTime = Math.max(...cats.map((c) => c.readingTime), 0),
		maxValue = Math.max(...cats.map((c) => c.val), 0);
	return !cats.length ? null : (
		<div class="dashboard-weread-stats-section">
			<div class="dashboard-weread-stats-section-title">{t('weread.preferCategory')}</div>
			<div class="dashboard-weread-prefercat">
				{cats.map((cat, i) => (
					<div key={i} class="dashboard-weread-prefercat-row">
						<div class="dashboard-weread-prefercat-name">{cat.title}</div>
						<div class="dashboard-weread-prefercat-bar-wrap">
							<div
								class="dashboard-weread-prefercat-bar"
								style={{
									width: `${Math.max(3, Math.min(100, Math.round((maxTime > 0 ? cat.readingTime / maxTime : maxValue > 0 ? cat.val / maxValue : 0) * 100)))}%`,
								}}
							/>
						</div>
						<div class="dashboard-weread-prefercat-val">
							{cat.readingTime > 0 ? formatReadTime(cat.readingTime) : `${cat.readingCount}本`}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
