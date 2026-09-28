import { getLanguage } from '../../../shared/i18n';
import { useWindowClock } from './use-window-clock';
export function WeekCalendarPanel({ win, accentLight }: { win: Window; accentLight: boolean }) {
	const now = useWindowClock(win),
		monday = new Date(now);
	monday.setDate(now.getDate() + (now.getDay() === 0 ? -6 : 1 - now.getDay()));
	return (
		<>
			{Array.from({ length: 7 }, (_, index) => {
				const date = new Date(monday);
				date.setDate(monday.getDate() + index);
				const today = date.toDateString() === now.toDateString();
				return (
					<div
						key={index}
						class={`dashboard-sidebar-week-cell${today ? ' dashboard-sidebar-week-cell--today' : ''}${today && accentLight ? ' dashboard-sidebar-week-cell--today-on-light' : ''}`}
					>
						<div class="dashboard-sidebar-week-day">
							{date.toLocaleDateString(getLanguage() === 'zh' ? 'zh-CN' : 'en', { weekday: 'narrow' })}
						</div>
						<div class="dashboard-sidebar-week-date">{date.getDate()}</div>
					</div>
				);
			})}
		</>
	);
}
