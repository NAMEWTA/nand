import { t } from '../../../shared/i18n';
import { useWindowClock } from './use-window-clock';
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
			<div class="dashboard-sidebar-year-progress-header">
				<span class="dashboard-sidebar-year-progress-year">{year}</span>
				<span class="dashboard-sidebar-year-progress-left">{t('yearProgress.remaining', { days: left })}</span>
			</div>
			<div class="dashboard-progress dashboard-sidebar-year-progress-bar">
				<div class="dashboard-progress-bar">
					<div class="dashboard-progress-fill" style={{ width: `${percent.toFixed(1)}%` }} />
				</div>
			</div>
			<div class="dashboard-sidebar-year-progress-sub">
				<span class="dashboard-sidebar-year-progress-day">
					{t('yearProgress.dayOfYear', { day, total: days })}
				</span>
				<span class="dashboard-sidebar-year-progress-percent">{percent.toFixed(1)}%</span>
			</div>
		</>
	);
}
