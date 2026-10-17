// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { useId, useState, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../ui/components/button';
import { cn } from '../../../ui/lib/utils';
import { useT } from '../../../ui/react/hooks';
import { addMonths, formatDate, startOfDay, usesIsoWeek } from '../core/moment-format';
import { formatOptionsFor, monthGrid, type Period } from '../core/periodic';
import { useEnv, useIndexVersion, useNavigatorSettings, usePreviewVersion } from './hooks';

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Month view under the navigation pane: a dot marks days with a note, a click opens (or creates) that day's note. */
export function CalendarPanel() {
	const env = useEnv();
	const { service, actions } = env;
	const t = useT();
	const titleId = useId();
	const settings = useNavigatorSettings(service);
	useIndexVersion(service);
	usePreviewVersion(env);
	const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
	if (!actions) return null;
	const { rules, weekStart, locale } = actions.periodic.config();
	const today = startOfDay(new Date());
	const grid = monthGrid(month, weekStart);
	const open = (period: Period, date: Date, event?: MouseEvent) => {
		const newTab = !!event && (env.isMac ? event.metaKey : event.ctrlKey);
		void actions.openPeriod(period, date, { newTab }).catch(env.report);
	};
	const quarter = Math.floor(month.getMonth() / 3) + 1;
	const link = (period: Period, label: string, key: string) => (
		<Button key={key} type="button" variant="ghost" size="sm" className="h-6 shrink-0 px-1 text-xs font-medium" disabled={!rules[period].enabled} onClick={(event) => open(period, month, event)}>
			{label}
		</Button>
	);

	return (
		<section aria-labelledby={titleId} className="max-h-[70%] min-h-16 select-none overflow-y-auto border-t border-sidebar-border px-2 pb-2 pt-1" data-navigator-calendar>
			<header className="flex items-center justify-between gap-0.5">
				<Button type="button" variant="ghost" size="icon-sm" className="size-6 shrink-0" aria-label={t('navigator.calendarPrevious')} onClick={() => setMonth((current) => addMonths(current, -1))}><ChevronLeft className="size-4" /></Button>
				<div id={titleId} className="flex min-w-0 flex-1 flex-nowrap items-center justify-center">
					{link('month', formatDate(month, 'MMMM', { locale }), 'month')}
					{link('year', formatDate(month, 'YYYY', { locale }), 'year')}
					{link('quarter', `Q${quarter}`, 'quarter')}
				</div>
				<div className="flex shrink-0 items-center">
					<Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>{t('navigator.calendarToday')}</Button>
					<Button type="button" variant="ghost" size="icon-sm" className="size-6 shrink-0" aria-label={t('navigator.calendarNext')} onClick={() => setMonth((current) => addMonths(current, 1))}><ChevronRight className="size-4" /></Button>
				</div>
			</header>
			<div className={cn('mt-1 grid gap-px text-center text-[11px] text-muted-foreground', settings.calendarWeekNumbers ? 'grid-cols-[1.5rem_repeat(7,minmax(0,1fr))]' : 'grid-cols-7')}>
				{settings.calendarWeekNumbers && <span aria-hidden />}
				{Array.from({ length: 7 }, (_, column) => {
					const day = grid[0]![column]!;
					return <span key={column} aria-hidden>{formatDate(day, 'dd', { locale })}</span>;
				})}
			</div>
			<div className="grid gap-px">
				{grid.map((week) => {
					const first = week[0]!;
					// The fourth day is in the same week under any first-day-of-week rule (ISO weeks start on Monday, rows on `weekStart`).
					const inWeek = week[3]!;
					const weekRule = rules.week;
					const weekOptions = formatOptionsFor(weekRule, weekStart, locale);
					const weekNumber = formatDate(inWeek, usesIsoWeek(weekRule.format) ? 'W' : 'w', weekOptions);
					return (
						<div key={first.getTime()} className={cn('grid gap-px', settings.calendarWeekNumbers ? 'grid-cols-[1.5rem_repeat(7,minmax(0,1fr))]' : 'grid-cols-7')}>
							{settings.calendarWeekNumbers && (
								<Button type="button" variant="ghost" size="sm" className="h-6 px-0 text-[11px] font-normal tabular-nums text-muted-foreground" disabled={!weekRule.enabled} aria-label={t('navigator.calendarWeek', { week: weekNumber })} onClick={(event) => open('week', inWeek, event)}>
									{weekNumber}
								</Button>
							)}
							{week.map((date) => {
								const inMonth = date.getMonth() === month.getMonth();
								const note = actions.periodic.existing('day', date);
								const isToday = sameDay(date, today);
								const image = settings.calendarImages && note ? imageOf(env, note.path) : undefined;
								return (
									<button
										key={date.getTime()}
										type="button"
										aria-label={formatDate(date, 'dddd, MMMM D, YYYY', { locale })}
										aria-current={isToday ? 'date' : undefined}
										data-has-note={note ? 'true' : undefined}
										data-date={formatDate(date, 'YYYY-MM-DD')}
										className={cn(
											'relative flex h-6 cursor-pointer items-center justify-center overflow-hidden rounded-md border-0 bg-transparent p-0 text-xs tabular-nums shadow-none hover:bg-sidebar-accent',
											!inMonth && 'text-muted-foreground/60',
											isToday && 'ring-1 ring-inset ring-primary',
											note && 'font-medium',
										)}
										onClick={(event) => open('day', date, event)}
									>
										{image && <img alt="" src={image} className="absolute inset-0 size-full object-cover opacity-50" />}
										<span className="relative">{date.getDate()}</span>
										{note && <span aria-hidden className="absolute bottom-0.5 size-1 rounded-full bg-primary" />}
									</button>
								);
							})}
						</div>
					);
				})}
			</div>
		</section>
	);
}

/** Feature image of a day's note, from the preview cache (requested while the cell is shown). */
function imageOf(env: ReturnType<typeof useEnv>, path: string): string | undefined {
	env.previews.request(path);
	const image = env.previews.get(path)?.image;
	return image ? env.imageUrl(image) : undefined;
}
