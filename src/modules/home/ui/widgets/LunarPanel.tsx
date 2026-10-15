// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/lunar-widget.ts
import { RecordButton as Button } from '../dialogs/RecordButton';
import { widgetClasses } from '../theme/widget-classes';
import type { HolidayInfo } from '../../platform/calendar/holiday-service';
import { getLanguage, t } from '../../../../shared/i18n';
import { useEffect, useState } from 'react';
import { loadLunar, lunarCompute } from './lunar-model';
import { useWindowClock } from './use-record-clock';
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
	const [lunar, setLunar] = useState(lunarCompute);
	useEffect(() => {
		let live = true;
		if (!lunar)
			void loadLunar().then(
				() => {
					if (live) setLunar(lunarCompute);
				},
				() => undefined,
			);
		return () => {
			live = false;
		};
	}, [lunar]);
	if (!lunar) return null;
	let data;
	try {
		data = lunar.computeLunarData(now, holidays);
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
			<Button
				variant="ghost"
				type="button"
				className={widgetClasses('dashboard-sidebar-lunar-fortune-btn')}
				aria-label={t('fortune.title')}
				onClick={fortune}
			>
				🎐
			</Button>
			<div className={widgetClasses('dashboard-sidebar-lunar-header')}>
				<div className={widgetClasses('dashboard-sidebar-lunar-meta')}>
					<span className={widgetClasses('dashboard-sidebar-lunar-ganzhi')}>
						{t('lunar.year', { value: data.ganZhiYear })}
					</span>
					<span className={widgetClasses('dashboard-sidebar-lunar-zodiac')}>{data.zodiac}</span>
					<span className={widgetClasses('dashboard-sidebar-lunar-ganzhi')}>
						{t('lunar.monthDay', { month: data.ganZhiMonth, day: data.ganZhiDay })}
					</span>
					{data.jieQi && <span className={widgetClasses('dashboard-sidebar-lunar-jieqi')}>{data.jieQi}</span>}
				</div>
				<div className={widgetClasses('dashboard-sidebar-lunar-date')}>
					<span>{data.lunarDate}</span>
					{badges.map((badge, i) => (
						<div
							key={i}
							className={widgetClasses(
								`dashboard-sidebar-lunar-badge dashboard-sidebar-lunar-badge--${badge.kind} dashboard-sidebar-lunar-badge--inline`,
							)}
						>
							{badge.text}
						</div>
					))}
				</div>
			</div>
			{zh && (
				<div className={widgetClasses('dashboard-sidebar-lunar-almanac')}>
					{comma < 0 ? (
						<span className={widgetClasses('dashboard-sidebar-lunar-almanac-text')}>{data.almanac}</span>
					) : (
						<>
							<span className={widgetClasses('dashboard-sidebar-lunar-almanac-text')}>
								{data.almanac.slice(0, comma + 1)}
							</span>
							<br />
							<span className={widgetClasses('dashboard-sidebar-lunar-almanac-text')}>
								{data.almanac.slice(comma + 1)}
							</span>
						</>
					)}
				</div>
			)}
		</>
	);
}
