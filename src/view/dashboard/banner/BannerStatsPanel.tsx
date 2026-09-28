import type { App } from 'obsidian';
import { useLayoutEffect, useState } from 'preact/hooks';
import type { BannerStatsConfig } from '../../../core/dashboard/types';
import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
import {
	CENTER_ICONS,
	HEATMAP_DAYS,
	LEFT_ICONS,
	RIGHT_ICONS,
	centerSub,
	centerValue,
	formatInt,
	habitCenterSub,
	habitHeatmapSeries,
	heatLevel,
	leftValue,
	rightValue,
	type BannerStatsResult,
} from './stats-data';
function Count({
	target,
	format,
	animate,
	win,
}: {
	target: number;
	format: (value: number) => string;
	animate: boolean;
	win: Window;
}) {
	const [value, setValue] = useState(target);
	useLayoutEffect(() => {
		if (!animate || target <= 0 || win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
			setValue(target);
			return;
		}
		let frame = 0;
		const start = win.performance.now();
		const tick = (now: number) => {
			const progress = Math.min(1, (now - start) / 800);
			setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
			if (progress < 1) frame = win.requestAnimationFrame(tick);
		};
		frame = win.requestAnimationFrame(tick);
		return () => win.cancelAnimationFrame(frame);
	}, [target, animate, win]);
	return <div class="dashboard-banner-stat-num">{format(value)}</div>;
}
export function BannerStatsPanel({
	app,
	config,
	result: r,
	animate,
	win,
}: {
	app: App;
	config: BannerStatsConfig;
	result: BannerStatsResult;
	animate: boolean;
	win: Window;
}) {
	const left = config.leftStat ?? 'totalNotes',
		center = config.centerStat ?? 'streak',
		centerCount = centerValue(center, r),
		habit = habitHeatmapSeries(app, config, HEATMAP_DAYS),
		series = habit ?? r.activity,
		max = Math.max(1, ...series);
	return (
		<>
			{config.showLeft !== false && (
				<div class="dashboard-banner-stat-col dashboard-banner-stat-col--left">
					<div class="dashboard-banner-stat-top">
						<div class="dashboard-banner-stat-hero">
							<Icon className="dashboard-banner-stat-icon" name={LEFT_ICONS[left]} />
							<Count target={leftValue(left, r)} format={formatInt} animate={animate} win={win} />
							<div class="dashboard-banner-stat-label dashboard-banner-stat-label--inline">
								{t(`banner.stats.${left}`)}
							</div>
						</div>
					</div>
					{config.showDetails !== false && (
						<div class="dashboard-banner-stat-strip">
							{[
								{ icon: 'calendar-plus', text: t('banner.stats.stripMonth', { n: r.newThisMonth }) },
								{ icon: 'hash', text: t('banner.stats.stripTags', { n: r.tagsCount }) },
								{ icon: 'link', text: t('banner.stats.stripLinks', { n: r.totalLinks }) },
							].map((item) => (
								<div key={item.icon} class="dashboard-banner-stat-strip-item">
									<Icon className="dashboard-banner-stat-strip-icon" name={item.icon} />
									<span>{item.text}</span>
								</div>
							))}
						</div>
					)}
				</div>
			)}
			{config.showCenter !== false && (
				<div class="dashboard-banner-stat-col dashboard-banner-stat-col--center">
					<div class="dashboard-banner-stat-top">
						<div class="dashboard-banner-stat-hero">
							<Icon className="dashboard-banner-stat-icon" name={CENTER_ICONS[center]} />
							<Count target={centerCount.text} format={centerCount.format} animate={animate} win={win} />
							<div class="dashboard-banner-stat-label dashboard-banner-stat-label--inline">
								{t(
									center === 'streak' && !r.hasDailySource
										? 'banner.stats.active'
										: `banner.stats.${center}`,
								)}
							</div>
						</div>
					</div>
					{config.showDetails !== false && (
						<>
							<div class="dashboard-banner-stat-sub">
								{habit ? habitCenterSub(app, config) : centerSub(center, r)}
							</div>
							<div class="dashboard-banner-stat-chart">
								<div class="dashboard-banner-heatmap">
									{series.map((value, index) => (
										<div
											key={index}
											class={`dashboard-banner-heatmap-cell dashboard-banner-heatmap-cell--l${heatLevel(value, max)}${index === series.length - 1 ? ' dashboard-banner-heatmap-cell--today' : ''}`}
										/>
									))}
								</div>
							</div>
						</>
					)}
				</div>
			)}
			{config.showRight !== false && (
				<div class="dashboard-banner-stat-col dashboard-banner-stat-col--right">
					{(config.rightStats ?? ['taskCompletion', 'connectivity', 'avgLinksPerNote']).map((stat) => {
						const { value, pct } = rightValue(stat, r);
						return (
							<div key={stat} class="dashboard-banner-stat-prog">
								<div class="dashboard-banner-stat-prog-head">
									<div class="dashboard-banner-stat-prog-title">
										<Icon className="dashboard-banner-stat-prog-icon" name={RIGHT_ICONS[stat]} />
										<span>{t(`banner.stats.${stat}`)}</span>
									</div>
									<div class="dashboard-banner-stat-prog-val">{value}</div>
								</div>
								{config.showDetails !== false && (
									<div class="dashboard-banner-stat-prog-track">
										<div class="dashboard-banner-stat-prog-fill" style={{ width: `${pct}%` }} />
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</>
	);
}
