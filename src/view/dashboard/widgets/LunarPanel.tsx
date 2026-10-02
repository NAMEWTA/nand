import type { HolidayInfo } from '../../../platform/obsidian/calendar/holiday-service';
import { getLanguage, t } from '../../../shared/i18n';
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
		data.holiday?.holiday ? { kind: 'holiday', text: data.holiday.name || t('lunar.holiday') } : null,
		data.holiday?.type === 3 ? { kind: 'work', text: t('lunar.makeupWork') } : null,
		!data.holiday && [0, 6].includes(now.getDay()) ? { kind: 'weekend', text: t('lunar.weekend') } : null,
		...data.festivals.slice(0, 2).map((text) => ({ kind: 'festival', text })),
	].filter((item) => item !== null);
	return (
		<>
			<button type="button" class="dashboard-sidebar-lunar-fortune-btn" aria-label={t('fortune.title')} onClick={fortune}>
				🎐
			</button>
			<div class="dashboard-sidebar-lunar-header">
				<div class="dashboard-sidebar-lunar-meta">
					<span class="dashboard-sidebar-lunar-ganzhi">{t('lunar.year', { value: data.ganZhiYear })}</span>
					<span class="dashboard-sidebar-lunar-zodiac">{data.zodiac}</span>
					<span class="dashboard-sidebar-lunar-ganzhi">
						{t('lunar.monthDay', { month: data.ganZhiMonth, day: data.ganZhiDay })}
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
