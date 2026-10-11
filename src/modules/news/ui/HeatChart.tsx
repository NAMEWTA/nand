import { useState } from 'preact/hooks';
import { getLanguage, t } from '../../../shared/i18n';
import { heatSeries, type HeatFact } from '../core/heat';
import type { NewsHeatSnapshot } from '../core/model';
import type { HeatRules } from '../core/editorial-rules';

const SPANS = [24, 72, 168] as const;
const HOUR = 3_600_000;

function stamp(hour: number): string {
	return new Date(hour).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
}

/** One event curve. Unobserved hours are gaps, and fewer than three points draw nothing. */
export function HeatChart({ points, facts, now, eventId, rules }: { points: readonly NewsHeatSnapshot[]; facts: readonly HeatFact[]; now: number; eventId?: string; rules?: HeatRules }) {
	const [span, setSpan] = useState<(typeof SPANS)[number]>(168);
	const [selectedHour, setSelectedHour] = useState<number>();
	const series = heatSeries(points, now, span, eventId, facts, rules);
	const index = series.points.findIndex(point => point.hour === selectedHour);
	const selected = series.points[index];
	const onKey = (event: KeyboardEvent) => {
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			setSelectedHour(series.points[Math.min(series.points.length - 1, index + 1)]?.hour);
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			setSelectedHour(series.points[index < 0 ? series.points.length - 1 : Math.max(0, index - 1)]?.hour);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			setSelectedHour(undefined);
		}
	};
	const width = 240;
	const height = 48;
	const xOf = (hour: number) => (series.to === series.from ? width / 2 : 4 + ((hour - series.from) / (series.to - series.from)) * (width - 8));
	const max = Math.max(...series.points.map((point) => point.heat), 1);
	const yOf = (heat: number) => height - 4 - (heat / max) * (height - 8);
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
				<button key={item} type="button" aria-pressed={span === item} onClick={() => { setSpan(item); setSelectedHour(undefined); }}>
					{t(`news.heat${item}`)}
				</button>
			))}
			{series.points.length > 0 && <p>{t('news.heatRange', { from: stamp(series.from), to: stamp(series.to) })}</p>}
			{!series.draw && <p>{t('news.heatInsufficient')}</p>}
			<div class="nand-news-heat-selected" role="status" aria-live="polite">
				{selected ? t('news.heatPoint', { heat: selected.heat, time: stamp(selected.hour) }) : ''}
			</div>
			<div class="nand-news-heat-chart" tabIndex={0} aria-label={t('news.heatChart')} onKeyDown={onKey}>
				{series.points.map((point) => (
					<span key={point.hour} class="nand-visually-hidden" data-hour={point.hour}>{point.heat}</span>
				))}
				{series.draw && (
					<svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} aria-hidden="true" onPointerDown={event => {
						const rect = event.currentTarget.getBoundingClientRect();
						const target = (event.clientX - rect.left) / rect.width * width;
						const nearest = series.points.slice().sort((a, b) => Math.abs(xOf(a.hour) - target) - Math.abs(xOf(b.hour) - target))[0];
						setSelectedHour(nearest?.hour);
					}}>
						{runs.filter((run) => run.length > 1).map((run) => (
							<polyline key={run[0]?.hour} class="nand-news-heat-line" points={run.map((point) => `${xOf(point.hour)},${yOf(point.heat)}`).join(' ')} />
						))}
						{series.points.map(point => <circle key={point.hour} class="nand-news-heat-point" cx={xOf(point.hour)} cy={yOf(point.heat)} r={selectedHour === point.hour ? 3.5 : 2} />)}
					</svg>
				)}
			</div>
		</section>
	);
}
