import { useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { heatSeries } from '../core/heat';
import type { NewsHeatSnapshot } from '../core/model';

const SPANS = [24, 72, 168] as const;
const HOUR = 3_600_000;

function stamp(hour: number): string {
	return new Date(hour).toISOString().slice(0, 16).replace('T', ' ');
}

/** One event curve. Unobserved hours are gaps, and fewer than three points draw nothing. */
export function HeatChart({ points, now, eventId }: { points: readonly NewsHeatSnapshot[]; now: number; eventId?: string }) {
	const [span, setSpan] = useState<(typeof SPANS)[number]>(168);
	const [index, setIndex] = useState(-1);
	const series = heatSeries(points, now, span, eventId);
	const selected = series.points[index];
	const onKey = (event: KeyboardEvent) => {
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			setIndex((current) => Math.min(series.points.length - 1, current + 1));
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			setIndex((current) => (current <= 0 ? 0 : current - 1));
		} else if (event.key === 'Escape') {
			event.preventDefault();
			setIndex(-1);
		}
	};
	const width = 240;
	const height = 48;
	const xOf = (hour: number) => (series.to === series.from ? width / 2 : ((hour - series.from) / (series.to - series.from)) * width);
	const max = Math.max(...series.points.map((point) => point.heat), 1);
	const yOf = (heat: number) => height - (heat / max) * (height - 4) - 2;
	const runs: { hour: number; heat: number }[][] = [];
	for (const point of series.points) {
		const run = runs[runs.length - 1];
		const prev = run?.[run.length - 1];
		if (prev && point.hour - prev.hour === HOUR) run.push(point);
		else runs.push([point]);
	}
	return (
		<section class="nand-news-heat">
			<h2>{t('news.heatChart')}</h2>
			{SPANS.map((item) => (
				<button key={item} type="button" aria-pressed={span === item} onClick={() => { setSpan(item); setIndex(-1); }}>
					{t(`news.heat${item}`)}
				</button>
			))}
			{series.points.length > 0 && <p>{t('news.heatRange', { from: stamp(series.from), to: stamp(series.to) })}</p>}
			<div class="nand-visually-hidden" role="status" aria-live="polite">
				{selected ? t('news.heatPoint', { heat: selected.heat, time: stamp(selected.hour) }) : ''}
			</div>
			<div class="nand-news-heat-chart" tabIndex={0} aria-label={t('news.heatChart')} onKeyDown={onKey}>
				{series.points.map((point) => (
					<span key={point.hour} class="nand-visually-hidden" data-hour={point.hour}>{point.heat}</span>
				))}
				{series.draw && (
					<svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
						{runs.filter((run) => run.length > 1).map((run) => (
							<polyline key={run[0]?.hour} class="nand-news-heat-line" points={run.map((point) => `${xOf(point.hour)},${yOf(point.heat)}`).join(' ')} />
						))}
					</svg>
				)}
			</div>
		</section>
	);
}
