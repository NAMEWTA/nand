// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/expense-stats-modal.ts
import { widgetClasses } from '../theme/widget-classes';
import { Fragment } from 'react';
import { useState } from 'react';
import type { ExpenseBar, ExpenseRankRow, ExpenseSlice } from './expense-charts';
function Empty({ text }: { text: string }) {
	return <div className={widgetClasses('dashboard-expense-donut-empty')}>{text}</div>;
}
export function ExpenseDonut({
	slices,
	formatValue,
	emptyText,
}: {
	slices: ExpenseSlice[];
	formatValue: (n: number) => string;
	emptyText: string;
}) {
	const [hover, setHover] = useState<string | null>(null);
	const total = slices.reduce((a, b) => a + b.value, 0),
		active = slices.find((s) => s.key === hover);
	const circumference = 2 * Math.PI * 85,
		gap = slices.length > 1 ? 3 : 0;
	if (total <= 0) return <Empty text={emptyText} />;
	return (
		<>
			<div className={widgetClasses('dashboard-expense-donut-wrap')}>
				<svg
					className={widgetClasses('dashboard-expense-donut-svg')}
					viewBox="0 0 200 200"
					width="200"
					height="200"
				>
					<circle
						className={widgetClasses('dashboard-expense-donut-bg')}
						cx="100"
						cy="100"
						r="85"
						fill="none"
						strokeWidth="30"
					/>
					<text
						className={widgetClasses('dashboard-expense-donut-center-value')}
						x="100"
						y="94"
						textAnchor="middle"
						dominantBaseline="middle"
					>
						{formatValue(active?.value ?? total)}
					</text>
					<text
						className={widgetClasses('dashboard-expense-donut-center-label')}
						x="100"
						y="116"
						textAnchor="middle"
						dominantBaseline="middle"
					>
						{active ? `${active.label} · ${Math.round((active.value / total) * 100)}%` : ''}
					</text>
					{slices.map((slice, index) => {
						const dash = Math.max(0, (circumference * slice.value) / total - gap),
							start = slices
								.slice(0, index)
								.reduce(
									(sum, item) => sum + Math.max(0, (circumference * item.value) / total - gap) + gap,
									0,
								);
						return (
							<circle
								key={slice.key}
								className={widgetClasses('dashboard-expense-donut-segment')}
								cx="100"
								cy="100"
								r="85"
								fill="none"
								strokeWidth={hover === slice.key ? 36 : 30}
								strokeDasharray={`${dash} ${circumference - dash}`}
								strokeDashoffset={-start}
								transform="rotate(-90 100 100)"
								strokeLinecap="butt"
								style={{ stroke: slice.color }}
								onMouseEnter={() => setHover(slice.key)}
								onMouseLeave={() => setHover(null)}
							/>
						);
					})}
				</svg>
			</div>
			<div className={widgetClasses('dashboard-expense-donut-legend dashboard-expense-donut-legend--grid')}>
				{slices.map((s) => (
					<div key={s.key} className={widgetClasses('dashboard-expense-donut-legend-item')}>
						<div
							className={widgetClasses('dashboard-expense-donut-legend-dot')}
							style={{ backgroundColor: s.color }}
						/>
						<div className={widgetClasses('dashboard-expense-donut-legend-name')}>{s.label}</div>
						<div className={widgetClasses('dashboard-expense-donut-legend-pct')}>
							{Math.round((s.value / total) * 100)}%
						</div>
						<div className={widgetClasses('dashboard-expense-donut-legend-amount')}>
							{formatValue(s.value)}
						</div>
					</div>
				))}
			</div>
		</>
	);
}
function useChartTip() {
	const [root, setRoot] = useState<HTMLDivElement | null>(null),
		[tip, setTip] = useState<{ text: string; left: number; top: number; above: boolean } | null>(null);
	return {
		setRoot,
		show: (target: Element, text: string) => {
			const c = root?.getBoundingClientRect();
			if (!c) return;
			const b = target.getBoundingClientRect(),
				above = b.top - c.top >= 34;
			setTip({
				text,
				above,
				left: Math.round(Math.min(Math.max(b.left + b.width / 2 - c.left, 40), Math.max(40, c.width - 40))),
				top: Math.round(above ? b.top - c.top - 4 : b.bottom - c.top + 6),
			});
		},
		hide: () => setTip(null),
		tip: (
			<div
				className={widgetClasses(
					`dashboard-expense-chart-tip${tip ? ' dashboard-expense-chart-tip--visible' : ''}`,
				)}
				style={
					tip
						? {
								left: tip.left,
								top: tip.top,
								transform: tip.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
							}
						: {}
				}
			>
				{tip?.text}
			</div>
		),
	};
}
type ChartProps = { bars: ExpenseBar[]; primaryColor: string; secondaryColor: string; emptyText: string };
export function ExpenseTrend({ bars, primaryColor, secondaryColor, emptyText }: ChartProps) {
	const { setRoot, show, hide, tip } = useChartTip();
	if (!bars.some((b) => b.value > 0 || (b.secondary ?? 0) > 0)) return <Empty text={emptyText} />;
	const paired = bars.some((b) => (b.secondary ?? 0) > 0),
		max = Math.max(...bars.map((b) => Math.max(b.value, b.secondary ?? 0)), 1),
		step = 520 / bars.length,
		w = paired ? Math.max(2, Math.min(14, step * 0.32)) : Math.max(2, Math.min(18, step * 0.6));
	return (
		<div ref={setRoot} className={widgetClasses('dashboard-expense-trend-container')}>
			<svg
				className={widgetClasses('dashboard-expense-trend-svg')}
				viewBox="0 0 520 146"
				width="100%"
				height="146"
			>
				{bars.map((bar, i) => (
					<Fragment key={i}>
						{(paired ? [bar.value, bar.secondary ?? 0] : [bar.value]).map((value, j) => {
							const h = Math.round((value / max) * 120);
							return (
								<rect
									key={j}
									className={widgetClasses('dashboard-expense-trend-bar')}
									x={i * step + (step - (paired ? w * 2 + 2 : w)) / 2 + j * (w + 2)}
									y={130 - h}
									width={w}
									height={Math.max(value > 0 ? 2 : 0, h)}
									rx="2"
									style={{ fill: j ? secondaryColor : primaryColor }}
									onMouseEnter={(e) => show(e.currentTarget, bar.tooltip)}
									onMouseLeave={hide}
								>
									<title>{bar.tooltip}</title>
								</rect>
							);
						})}
						{(bars.length <= 14 || i % Math.ceil(bars.length / 12) === 0) && (
							<text
								className={widgetClasses('dashboard-expense-trend-tick')}
								x={i * step + step / 2}
								y="142"
								textAnchor="middle"
							>
								{bar.label}
							</text>
						)}
					</Fragment>
				))}
			</svg>
			{tip}
		</div>
	);
}
export function ExpenseRanking({
	rows,
	colorOf,
	formatValue,
	emptyText,
}: {
	rows: ExpenseRankRow[];
	colorOf: (key: string) => string;
	formatValue: (n: number) => string;
	emptyText: string;
}) {
	if (!rows.length) return <Empty text={emptyText} />;
	const max = Math.max(...rows.map((r) => r.value), 1);
	return (
		<>
			{rows.map((row) => (
				<div key={row.key} className={widgetClasses('dashboard-expense-rank-row')}>
					<div className={widgetClasses('dashboard-expense-rank-head')}>
						<div
							className={widgetClasses('dashboard-expense-donut-legend-dot')}
							style={{ backgroundColor: colorOf(row.key) }}
						/>
						<div className={widgetClasses('dashboard-expense-rank-name')}>{row.label}</div>
						<div className={widgetClasses('dashboard-expense-rank-amount')}>{formatValue(row.value)}</div>
					</div>
					<div className={widgetClasses('dashboard-expense-rank-bar-wrap')}>
						<div
							className={widgetClasses('dashboard-expense-rank-bar')}
							style={{
								width: `${Math.max(3, Math.round((row.value / max) * 100))}%`,
								backgroundColor: colorOf(row.key),
							}}
						/>
					</div>
				</div>
			))}
		</>
	);
}
export function ExpenseLines({
	bars,
	primaryColor,
	secondaryColor,
	primaryLabel,
	secondaryLabel,
	emptyText,
}: ChartProps & { primaryLabel: string; secondaryLabel: string }) {
	const { setRoot, show, hide, tip } = useChartTip(),
		[hover, setHover] = useState<number | null>(null);
	if (!bars.some((b) => b.value > 0 || (b.secondary ?? 0) > 0)) return <Empty text={emptyText} />;
	const max = Math.max(...bars.map((b) => Math.max(b.value, b.secondary ?? 0)), 1),
		step = 520 / bars.length,
		y = (v: number) => 120 - Math.round((v / max) * 110);
	return (
		<div ref={setRoot} className={widgetClasses('dashboard-expense-lines-container')}>
			<div className={widgetClasses('dashboard-expense-lines-legend')}>
				{[
					[primaryColor, primaryLabel],
					[secondaryColor, secondaryLabel],
				].map(([color, label], i) => (
					<div
						key={i}
						className={widgetClasses(
							'dashboard-expense-donut-legend-item dashboard-expense-lines-legend-item',
						)}
					>
						<div
							className={widgetClasses('dashboard-expense-donut-legend-dot')}
							style={{ backgroundColor: color }}
						/>
						<div className={widgetClasses('dashboard-expense-lines-legend-name')}>{label}</div>
					</div>
				))}
			</div>
			<svg
				className={widgetClasses('dashboard-expense-lines-svg')}
				viewBox="0 0 520 136"
				width="100%"
				height="136"
			>
				<line className={widgetClasses('dashboard-expense-lines-baseline')} x1="0" y1="120" x2="520" y2="120" />
				{[primaryColor, secondaryColor].map((color, j) => (
					<Fragment key={j}>
						<polyline
							className={widgetClasses('dashboard-expense-lines-line')}
							points={bars
								.map((b, i) => `${i * step + step / 2},${y(j ? (b.secondary ?? 0) : b.value)}`)
								.join(' ')}
							style={{ stroke: color }}
						/>
						{bars.map((b, i) => (
							<circle
								key={i}
								className={widgetClasses('dashboard-expense-lines-dot')}
								cx={i * step + step / 2}
								cy={y(j ? (b.secondary ?? 0) : b.value)}
								r="2"
								style={{ fill: color }}
							/>
						))}
					</Fragment>
				))}
				<line
					className={widgetClasses(
						`dashboard-expense-lines-guide${hover !== null ? ' dashboard-expense-lines-guide--visible' : ''}`,
					)}
					x1={(hover ?? 0) * step + step / 2}
					x2={(hover ?? 0) * step + step / 2}
					y1="0"
					y2="120"
				/>
				{bars.map((b, i) => (
					<Fragment key={i}>
						<rect
							className={widgetClasses('dashboard-expense-lines-slot')}
							x={i * step}
							y="0"
							width={step}
							height="120"
							onMouseEnter={(e) => {
								setHover(i);
								show(e.currentTarget, b.tooltip);
							}}
							onMouseLeave={() => {
								setHover(null);
								hide();
							}}
						/>
						{(bars.length <= 14 || i % Math.ceil(bars.length / 12) === 0) && (
							<text
								className={widgetClasses('dashboard-expense-trend-tick')}
								x={i * step + step / 2}
								y="132"
								textAnchor="middle"
							>
								{b.label}
							</text>
						)}
					</Fragment>
				))}
			</svg>
			{tip}
		</div>
	);
}
