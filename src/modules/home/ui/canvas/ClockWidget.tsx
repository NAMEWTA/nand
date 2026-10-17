import type { BoardStore } from '../../services/board-store';
import { useClock } from '../board/hooks';

/** Time and date, scaled to the tile width so every size tier reads well. */
export function ClockWidget(_props: { store: BoardStore }) {
	const clock = useClock(1000),
		date = new Date(clock);
	return (
		<div className="dashboard-clock-widget flex h-full w-full flex-col items-center justify-center gap-1 [container-type:inline-size]">
			<time
				className="leading-none font-medium tracking-[.06em] text-[var(--db-text)] [font-size:clamp(1.2em,22cqw,4.5em)]"
				dateTime={date.toISOString()}
			>
				{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
			</time>
			<span className="text-[var(--db-text-muted)] [font-size:clamp(.7em,7cqw,1em)]">
				{date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
			</span>
		</div>
	);
}
