import { createPortal } from 'preact/compat';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../../../shared/i18n';
import { applyModalTheme } from '../appearance/modal-theme';
export function ReminderPicker({
	anchor,
	value,
	save,
	close,
}: {
	anchor: HTMLElement;
	value?: string;
	save: (value: string | undefined) => void;
	close: () => void;
}) {
	const initial = value ? new Date(value.replace(' ', 'T')) : new Date(),
		valid = Number.isNaN(initial.getTime()) ? new Date() : initial;
	const [date, setDate] = useState(valid),
		[month, setMonth] = useState(new Date(valid.getFullYear(), valid.getMonth(), 1)),
		[hour, setHour] = useState(value ? valid.getHours() : 9),
		[minute, setMinute] = useState(value ? valid.getMinutes() : 0),
		[position, setPosition] = useState({ top: 0, left: 0 });
	const popup = useRef<HTMLDivElement>(null),
		doc = anchor.ownerDocument,
		win = doc.defaultView;
	useLayoutEffect(() => {
		if (!win) return undefined;
		const element = popup.current;
		if (element) applyModalTheme(element);
		const move = () => {
			const r = anchor.getBoundingClientRect();
			if (!anchor.isConnected || r.bottom < 0 || r.top > win.innerHeight) {
				close();
				return;
			}
			setPosition({ top: r.bottom + 4, left: Math.max(0, Math.min(r.left, win.innerWidth - 240)) });
		};
		const outside = (e: MouseEvent) => {
			if (!popup.current?.contains(e.target as Node) && e.target !== anchor && !anchor.contains(e.target as Node))
				close();
		};
		const key = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.stopPropagation();
				close();
			}
		};
		move();
		doc.addEventListener('scroll', move, true);
		doc.addEventListener('mousedown', outside);
		doc.addEventListener('keydown', key, true);
		win.addEventListener('resize', move);
		return () => {
			doc.removeEventListener('scroll', move, true);
			doc.removeEventListener('mousedown', outside);
			doc.removeEventListener('keydown', key, true);
			win.removeEventListener('resize', move);
		};
	}, [anchor]);
	const year = month.getFullYear(),
		m = month.getMonth(),
		first = new Date(year, m, 1).getDay(),
		days = new Date(year, m + 1, 0).getDate(),
		today = new Date();
	const shift = (delta: number) => setMonth(new Date(year, m + delta, 1)),
		pad = (n: number) => String(n).padStart(2, '0');
	return createPortal(
		<div
			ref={popup}
			class="dashboard-task-reminder-popup"
			style={{ position: 'fixed', ...position }}
			onClick={(e) => e.stopPropagation()}
		>
			<div class="dashboard-task-reminder-calendar-nav">
				<button onClick={() => shift(-1)}>&lt;</button>
				<span>
					{year}-{pad(m + 1)}
				</span>
				<button onClick={() => shift(1)}>&gt;</button>
			</div>
			<div class="dashboard-task-reminder-calendar">
				{Array.from({ length: 7 }, (_, i) => (
					<div key={`day-${i}`} class="dashboard-task-reminder-calendar-header">
						{new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'short' })}
					</div>
				))}
				{Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => {
					const day = new Date(year, m, i - first + 1),
						outside = day.getMonth() !== m;
					return (
						<button
							key={i}
							disabled={outside}
							class={`dashboard-task-reminder-calendar-day${outside ? ' dashboard-task-reminder-calendar-day--other-month' : ''}${day.toDateString() === today.toDateString() ? ' dashboard-task-reminder-calendar-day--today' : ''}${day.toDateString() === date.toDateString() ? ' dashboard-task-reminder-calendar-day--selected' : ''}`}
							onClick={() => setDate(day)}
						>
							{day.getDate()}
						</button>
					);
				})}
			</div>
			<div class="dashboard-task-reminder-time">
				<select value={hour} onChange={(e) => setHour(Number(e.currentTarget.value))}>
					{Array.from({ length: 24 }, (_, n) => (
						<option key={n} value={n}>
							{pad(n)}
						</option>
					))}
				</select>
				<span>:</span>
				<select value={minute} onChange={(e) => setMinute(Number(e.currentTarget.value))}>
					{Array.from({ length: 60 }, (_, n) => (
						<option key={n} value={n}>
							{pad(n)}
						</option>
					))}
				</select>
			</div>
			<div class="dashboard-task-reminder-popup-btns">
				<button
					class="mod-cta"
					onClick={() => {
						save(
							`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(hour)}:${pad(minute)}`,
						);
						close();
					}}
				>
					{t('common.save')}
				</button>
				{value && (
					<button
						class="dashboard-task-reminder-clear"
						onClick={() => {
							save(undefined);
							close();
						}}
					>
						{t('reminder.clearReminder')}
					</button>
				)}
			</div>
		</div>,
		doc.body,
	);
}
