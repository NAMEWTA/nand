// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/year-progress-widget.ts
import { widgetClasses } from '../theme/widget-classes';
import { t } from '../../../../shared/i18n';
import { useWindowClock } from './use-record-clock';
export function YearProgressPanel({ win }: { win: Window }) {
	const now = useWindowClock(win),
		year = now.getFullYear(),
		start = new Date(year, 0, 1).getTime(),
		total = new Date(year + 1, 0, 1).getTime() - start,
		elapsed = now.getTime() - start;
	const percent = Math.max(0, Math.min(100, Math.round((elapsed / total) * 1000) / 10)),
		days = Math.round(total / 86400000),
		day = Math.floor(elapsed / 86400000) + 1,
		left = Math.max(0, days - day);
	return (
		<>
			<div className={widgetClasses('dashboard-sidebar-year-progress-header')}>
				<span className={widgetClasses('dashboard-sidebar-year-progress-year')}>{year}</span>
				<span className={widgetClasses('dashboard-sidebar-year-progress-left')}>
					{t('yearProgress.remaining', { days: left })}
				</span>
			</div>
			<div className={widgetClasses('dashboard-sidebar-year-progress-bar dashboard-progress')}>
				<div className={widgetClasses('dashboard-progress-bar')}>
					<div
						className={widgetClasses('dashboard-progress-fill')}
						style={{ width: `${percent.toFixed(1)}%` }}
					/>
				</div>
			</div>
			<div className={widgetClasses('dashboard-sidebar-year-progress-sub')}>
				<span className={widgetClasses('dashboard-sidebar-year-progress-day')}>
					{t('yearProgress.dayOfYear', { day, total: days })}
				</span>
				<span className={widgetClasses('dashboard-sidebar-year-progress-percent')}>{percent.toFixed(1)}%</span>
			</div>
		</>
	);
}
