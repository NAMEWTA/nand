// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/stats/ClaudeUsageDailyChart.tsx
import { useEffect, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import { useT } from '../../../../ui/react/hooks';
import { useOwnerDocument, useVisible } from '../../../../ui/react/contexts';
import type { UsageBucket } from '../../core/stats/aggregate';
export function DailyChart({ buckets }: { buckets: UsageBucket[] }) {
	const t = useT(),
		doc = useOwnerDocument(),
		visible = useVisible(),
		ref = useRef<HTMLCanvasElement>(null),
		[error, setError] = useState('');
	useEffect(() => {
		const canvas = ref.current;
		if (!canvas || !visible) return;
		let stopped = false,
			chart: Chart | undefined;
		void import('chart.js/auto')
			.then(({ default: ChartJS }) => {
				if (stopped) return;
				const dates = [...new Set(buckets.map((b) => b.date))],
					style = doc.defaultView!.getComputedStyle(canvas);
				const datasets = (['input', 'output', 'cacheRead', 'cacheWrite'] as const).map((key, index) => ({
					label: t(`agent.stats.${key}`),
					backgroundColor: style.getPropertyValue(`--chart-${index + 1}`).trim(),
					data: dates.map((date) =>
						buckets.filter((b) => b.date === date).reduce((sum, b) => sum + b[key], 0),
					),
				}));
				chart = new ChartJS(canvas, {
					type: 'bar',
					data: { labels: dates, datasets },
					options: {
						responsive: true,
						maintainAspectRatio: false,
						animation: false,
						scales: { x: { stacked: true }, y: { stacked: true } },
						plugins: { legend: { labels: { color: style.color } } },
					},
				});
			})
			.catch((e) => {
				if (!stopped) setError(String(e));
			});
		return () => {
			stopped = true;
			chart?.destroy();
		};
	}, [buckets, doc, visible, t]);
	return (
		<section className="rounded-lg border border-border/60 bg-card/40 p-4">
			<h3 className="mb-3 text-sm font-semibold">{t('agent.stats.daily')}</h3>
			<div className="relative h-56">
				<canvas ref={ref} role="img" aria-label={t('agent.stats.daily')} />
			</div>
			{error && <p role="alert">{error}</p>}
		</section>
	);
}
