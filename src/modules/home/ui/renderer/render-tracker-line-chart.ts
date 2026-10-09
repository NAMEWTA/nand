import {
	BarController,
	BarElement,
	CategoryScale,
	Chart,
	Filler,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Tooltip,
} from 'chart.js';
import type { CardSize } from '../../core/board/types/index';
import { getCSSVar, getRenderContext } from './render-context';

Chart.register(
	LineController,
	LineElement,
	PointElement,
	BarController,
	BarElement,
	LinearScale,
	CategoryScale,
	Filler,
	Tooltip,
);

export function renderTrackerLineChart(
	canvasEl: HTMLCanvasElement,
	data: import('../../core/board/types/index').TrackerDataPoint[],
	size: CardSize,
	accentColor: string,
	cardId: string,
): void {
	const ctx = canvasEl.getContext('2d');
	if (!ctx) return;

	const chart = new Chart(ctx, {
		type: 'line',
		data: {
			labels: data.map((p) => p.date.slice(5)),
			datasets: [
				{
					data: data.map((p) => p.value),
					borderColor: accentColor,
					backgroundColor: `${accentColor}22`,
					fill: true,
					tension: 0.4,
					pointRadius: size === 'L' ? 3 : 0,
					pointHoverRadius: 5,
					pointBackgroundColor: accentColor,
					borderWidth: 2,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { display: false }, tooltip: { enabled: true } },
			scales: {
				x: { display: false },
				y: { display: false },
			},
			animation: { duration: 600 },
		},
	});
	getRenderContext(canvasEl).chartInstances.set(cardId, chart);
}
export function renderTrackerBarChart(
	canvasEl: HTMLCanvasElement,
	data: import('../../core/board/types/index').TrackerDataPoint[],
	size: CardSize,
	accentColor: string,
	cardId: string,
): void {
	const ctx = canvasEl.getContext('2d');
	if (!ctx) return;

	const textColor = getCSSVar(canvasEl, '--db-text-muted') || '#888';
	const validVals = data.filter((p) => p.value !== null).map((p) => p.value!);
	const barMax = validVals.length > 0 ? Math.max(...validVals) : 1;

	const chart = new Chart(ctx, {
		type: 'bar',
		data: {
			labels: data.map((p) => p.date.slice(5)),
			datasets: [
				{
					data: data.map((p) => p.value ?? 0),
					backgroundColor: data.map((p) => {
						if (p.value === null) return 'transparent';
						const intensity = barMax > 0 ? p.value / barMax : 0;
						return `${accentColor}${Math.round(40 + intensity * 180)
							.toString(16)
							.padStart(2, '0')}`;
					}),
					borderRadius: 2,
					barPercentage: 0.8,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { display: false }, tooltip: { enabled: true } },
			scales: {
				x: { display: false },
				y: { display: size === 'L', grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
			},
			animation: { duration: 600 },
		},
	});
	getRenderContext(canvasEl).chartInstances.set(cardId, chart);
}
