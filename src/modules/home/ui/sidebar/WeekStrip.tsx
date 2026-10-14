// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts (renderSidebarWeekCalendar)
import { useLanguage } from '../../../../ui/react/hooks';
import { useClock } from '../board/hooks';
export function WeekStrip() {
	const language = useLanguage(),
		time = useClock(),
		today = new Date(time),
		monday = new Date(time);
	monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
	return (
		<div className="dashboard-week-strip flex min-h-[calc(1.6em+16px)] shrink-0 items-center gap-0.5 px-1">
			{Array.from({ length: 7 }, (_, i) => {
				const date = new Date(monday);
				date.setDate(monday.getDate() + i);
				return (
					<div
						key={i}
						className={`flex flex-1 flex-col items-center rounded-[var(--db-radius-sm)] px-0.5 py-1.5 ${date.toDateString() === today.toDateString() ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
					>
						<span className="mb-1 text-[.65em] leading-none tracking-[.02em]">
							{date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'narrow' })}
						</span>
						<span className="text-[.9em] leading-none font-semibold tabular-nums">{date.getDate()}</span>
					</div>
				);
			})}
		</div>
	);
}
