import type { HolidayInfo } from '../../../platform/obsidian/calendar/holiday-service';
import { getLanguage } from '../../../shared/i18n';
import { computeLunarData } from './lunar-model';
import { useWindowClock } from './use-window-clock';
export function LunarPanel({
	holidays,
	win,
	fortune,
}: {
	holidays: Record<string, HolidayInfo>;
	win: Window;
	fortune: () => void;
}) {
	const now = useWindowClock(win);
	let data;
	try {
		data = computeLunarData(now, holidays);
	} catch {
		return null;
	}
	const zh = getLanguage() === 'zh',
		comma = data.almanac.indexOf('，');
	const badges = [
		data.holiday?.holiday ? { kind: 'holiday', text: data.holiday.name || (zh ? '节假日' : 'Holiday') } : null,
		data.holiday?.type === 3 ? { kind: 'work', text: zh ? '补班' : 'Makeup work' } : null,
		!data.holiday && [0, 6].includes(now.getDay()) ? { kind: 'weekend', text: zh ? '周末' : 'Weekend' } : null,
		...data.festivals.slice(0, 2).map((text) => ({ kind: 'festival', text })),
	].filter((item) => item !== null);
	return (
		<>
			<div class="dashboard-sidebar-lunar-fortune-btn" role="button" onClick={fortune}>
				🎐
			</div>
			<div class="dashboard-sidebar-lunar-header">
				<div class="dashboard-sidebar-lunar-meta">
					<span class="dashboard-sidebar-lunar-ganzhi">{data.ganZhiYear}年</span>
					<span class="dashboard-sidebar-lunar-zodiac">{data.zodiac}</span>
					<span class="dashboard-sidebar-lunar-ganzhi">
						{data.ganZhiMonth}月 {data.ganZhiDay}日
					</span>
					{data.jieQi && <span class="dashboard-sidebar-lunar-jieqi">{data.jieQi}</span>}
				</div>
				<div class="dashboard-sidebar-lunar-date">
					<span>{data.lunarDate}</span>
					{badges.map((badge, i) => (
						<div
							key={i}
							class={`dashboard-sidebar-lunar-badge dashboard-sidebar-lunar-badge--${badge.kind} dashboard-sidebar-lunar-badge--inline`}
						>
							{badge.text}
						</div>
					))}
				</div>
			</div>
			{zh && (
				<div class="dashboard-sidebar-lunar-almanac">
					{comma < 0 ? (
						<span class="dashboard-sidebar-lunar-almanac-text">{data.almanac}</span>
					) : (
						<>
							<span class="dashboard-sidebar-lunar-almanac-text">{data.almanac.slice(0, comma + 1)}</span>
							<br />
							<span class="dashboard-sidebar-lunar-almanac-text">{data.almanac.slice(comma + 1)}</span>
						</>
					)}
				</div>
			)}
		</>
	);
}
