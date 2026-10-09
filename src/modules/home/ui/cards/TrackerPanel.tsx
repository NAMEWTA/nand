import type { App } from 'obsidian';
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { CardSize, DashboardCard, TrackerDataPoint } from '../../core/board/types/index';
import { computeStreak, readTrackerData } from '../../platform/widgets/tracker-service';
import { t } from '../../../../shared/i18n/index';
import { bindRenderContext, destroyChart, getCSSVar, type DashboardRenderContext } from '../renderer/render-context';
function TrackerChart({
	data,
	size,
	bar,
	id,
	context,
}: {
	data: TrackerDataPoint[];
	size: CardSize;
	bar: boolean;
	id: string;
	context: DashboardRenderContext;
}) {
	const canvas = useRef<HTMLCanvasElement>(null);
	useLayoutEffect(() => {
		const element = canvas.current;
		if (!element) return;
		bindRenderContext(element, context);
		destroyChart(element, id);
		const accent = getCSSVar(element, '--db-accent');
		let live = true;
		// chart.js (~160 KB) loads with the first tracker chart.
		void import('../renderer/render-tracker-line-chart').then(({ renderTrackerBarChart, renderTrackerLineChart }) => {
			if (!live) return;
			if (bar) renderTrackerBarChart(element, data, size, accent, id);
			else renderTrackerLineChart(element, data, size, accent, id);
		});
		return () => {
			live = false;
			destroyChart(element, id);
		};
	}, [data, size, bar, id, context]);
	return (
		<div class="dashboard-tracker-chart">
			<canvas ref={canvas} class="dashboard-chart-canvas" />
		</div>
	);
}
function Heatmap({ data, size, min, max }: { data: TrackerDataPoint[]; size: CardSize; min: number; max: number }) {
	const first = data[0] ? new Date(data[0].date + 'T00:00:00').getDay() : 1;
	const cells: (TrackerDataPoint | null)[] = [...Array<null>(first === 0 ? 6 : first - 1).fill(null), ...data];
	while (cells.length % 7) cells.push(null);
	const visible = cells.slice(-(size === 'M' ? 15 : 26) * 7);
	const cellSize = size === 'M' ? 10 : 14;
	return (
		<div class="dashboard-tracker-heatmap">
			<div
				class="dashboard-tracker-heatmap-grid"
				style={{
					display: 'grid',
					gridTemplateColumns: `repeat(${visible.length / 7}, ${cellSize}px)`,
					gridTemplateRows: `repeat(7, ${cellSize}px)`,
					gap: 2,
				}}
			>
				{visible.map((point, index) => (
					<div
						key={index}
						class={`dashboard-tracker-heatmap-cell${point?.value == null ? ' dashboard-tracker-heatmap-cell--empty' : ''}`}
						style={{
							width: cellSize,
							height: cellSize,
							borderRadius: Math.max(2, cellSize / 4),
							backgroundColor: point?.value == null ? undefined : 'var(--db-accent)',
							opacity:
								point?.value == null
									? undefined
									: 0.15 + ((point.value - min) / (max - min || 1)) * 0.85,
						}}
						title={point?.value == null ? undefined : `${point.date}: ${point.value}`}
					/>
				))}
			</div>
			{size === 'L' && (
				<div class="dashboard-tracker-heatmap-labels">
					{['M', '', 'W', '', 'F', '', 'S'].map((name) => (
						<div class="dashboard-tracker-heatmap-day-label">{name}</div>
					))}
				</div>
			)}
		</div>
	);
}
export function TrackerPanel({
	card,
	app,
	context,
}: {
	card: DashboardCard;
	app: App;
	context: DashboardRenderContext;
}) {
	const config = card.trackerConfig;
	if (!config) return null;
	const size = card.size || 'M';
	const data = readTrackerData(app, '', config.key, config.days);
	const points = data.filter((point) => point.value !== null);
	const values = points.map((point) => point.value!);
	if (!points.length)
		return (
			<div class={`dashboard-tracker dashboard-tracker--${size}`}>
				<div class="dashboard-tracker-empty">
					{t('tracker.noData')}: {config.key}
				</div>
			</div>
		);
	const latest = values[values.length - 1]!,
		previous = values[values.length - 2] ?? latest;
	const direction = latest > previous ? 'up' : latest < previous ? 'down' : 'flat';
	const percent = previous ? (((latest - previous) / Math.abs(previous)) * 100).toFixed(1) : '0';
	const min = Math.min(...values),
		max = Math.max(...values);
	const stats = [
		[t('tracker.current'), latest],
		[t('tracker.avg'), (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)],
		[t('tracker.trend'), `${direction === 'up' ? '+' : ''}${percent}%`],
	];
	if (size === 'L')
		stats.push([t('tracker.streak'), `${computeStreak(data)}d`], [t('tracker.min'), min], [t('tracker.max'), max]);
	return (
		<div class={`dashboard-tracker dashboard-tracker--${size}`}>
			{size === 'S' ? (
				<div class="dashboard-tracker-compact">
					<div class="dashboard-tracker-compact-value">{latest}</div>
					<div class={`dashboard-tracker-trend dashboard-tracker-trend--${direction}`}>
						{direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'}
					</div>
					{config.key && <div class="dashboard-tracker-compact-label">{config.key}</div>}
				</div>
			) : (
				<>
					{config.style === 'heatmap' ? (
						<Heatmap data={data} size={size} min={min} max={max} />
					) : (
						<TrackerChart
							data={data}
							size={size}
							bar={config.style === 'bar'}
							id={card.id}
							context={context}
						/>
					)}
					<div class="dashboard-tracker-stats">
						{stats.map(([label, value]) => (
							<div class="dashboard-tracker-stat" key={label}>
								<span class="dashboard-tracker-stat-label">{label}</span>
								<span class="dashboard-tracker-stat-value">{value}</span>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	);
}
