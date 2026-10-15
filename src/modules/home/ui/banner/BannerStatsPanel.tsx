// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/banner-section.ts
import { p1Classes } from '../theme/p1-classes';
import type { App } from 'obsidian';
import { useLayoutEffect, useState } from 'react';
import type { BannerStatsConfig } from '../../core/board/types';
import { t } from '../../../../shared/i18n';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
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
	return (
		<div className={p1Classes('dashboard-banner-stat-num')}>
			{format(
				!animate || target <= 0 || win.matchMedia?.('(prefers-reduced-motion: reduce)').matches
					? target
					: value,
			)}
		</div>
	);
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
				<div className={p1Classes('dashboard-banner-stat-col dashboard-banner-stat-col--left')}>
					<div className={p1Classes('dashboard-banner-stat-top')}>
						<div className={p1Classes('dashboard-banner-stat-hero')}>
							<Icon className={p1Classes('dashboard-banner-stat-icon')} name={LEFT_ICONS[left]} />
							<Count target={leftValue(left, r)} format={formatInt} animate={animate} win={win} />
							<div
								className={p1Classes('dashboard-banner-stat-label dashboard-banner-stat-label--inline')}
							>
								{t(`banner.stats.${left}`)}
							</div>
						</div>
					</div>
					{config.showDetails !== false && (
						<div className={p1Classes('dashboard-banner-stat-strip')}>
							{[
								{ icon: 'calendar-plus', text: t('banner.stats.stripMonth', { n: r.newThisMonth }) },
								{ icon: 'hash', text: t('banner.stats.stripTags', { n: r.tagsCount }) },
								{ icon: 'link', text: t('banner.stats.stripLinks', { n: r.totalLinks }) },
							].map((item) => (
								<div key={item.icon} className={p1Classes('dashboard-banner-stat-strip-item')}>
									<Icon className={p1Classes('dashboard-banner-stat-strip-icon')} name={item.icon} />
									<span>{item.text}</span>
								</div>
							))}
						</div>
					)}
				</div>
			)}
			{config.showCenter !== false && (
				<div className={p1Classes('dashboard-banner-stat-col dashboard-banner-stat-col--center')}>
					<div className={p1Classes('dashboard-banner-stat-top')}>
						<div className={p1Classes('dashboard-banner-stat-hero')}>
							<Icon className={p1Classes('dashboard-banner-stat-icon')} name={CENTER_ICONS[center]} />
							<Count target={centerCount.text} format={centerCount.format} animate={animate} win={win} />
							<div
								className={p1Classes('dashboard-banner-stat-label dashboard-banner-stat-label--inline')}
							>
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
							<div className={p1Classes('dashboard-banner-stat-sub')}>
								{habit ? habitCenterSub(app, config) : centerSub(center, r)}
							</div>
							<div className={p1Classes('dashboard-banner-stat-chart')}>
								<div className={p1Classes('dashboard-banner-heatmap')}>
									{series.map((value, index) => (
										<div
											key={index}
											className={p1Classes(
												`dashboard-banner-heatmap-cell dashboard-banner-heatmap-cell--l${heatLevel(value, max)}${index === series.length - 1 ? ' dashboard-banner-heatmap-cell--today' : ''}`,
											)}
										/>
									))}
								</div>
							</div>
						</>
					)}
				</div>
			)}
			{config.showRight !== false && (
				<div className={p1Classes('dashboard-banner-stat-col dashboard-banner-stat-col--right')}>
					{(config.rightStats ?? ['taskCompletion', 'connectivity', 'avgLinksPerNote']).map((stat) => {
						const { value, pct } = rightValue(stat, r);
						return (
							<div key={stat} className={p1Classes('dashboard-banner-stat-prog')}>
								<div className={p1Classes('dashboard-banner-stat-prog-head')}>
									<div className={p1Classes('dashboard-banner-stat-prog-title')}>
										<Icon
											className={p1Classes('dashboard-banner-stat-prog-icon')}
											name={RIGHT_ICONS[stat]}
										/>
										<span>{t(`banner.stats.${stat}`)}</span>
									</div>
									<div className={p1Classes('dashboard-banner-stat-prog-val')}>{value}</div>
								</div>
								{config.showDetails !== false && (
									<div className={p1Classes('dashboard-banner-stat-prog-track')}>
										<div
											className={p1Classes('dashboard-banner-stat-prog-fill')}
											style={{ width: `${pct}%` }}
										/>
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
