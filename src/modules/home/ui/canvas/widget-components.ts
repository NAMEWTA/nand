import type { ComponentType } from 'react';
import type { BoardStore } from '../../services/board-store';
import { Banner } from '../banner/Banner';
import { AlbumWidget } from '../widgets/AlbumWidget';
import { AnniversaryWidget } from '../widgets/AnniversaryWidget';
import { CalendarWidget } from '../widgets/CalendarWidget';
import { CountdownWidget } from '../widgets/CountdownWidget';
import { ExpenseWidget } from '../widgets/ExpenseWidget';
import { HabitWidget } from '../widgets/HabitWidget';
import { FileSearchWidget, QuickCaptureWidget } from '../widgets/InputWidgets';
import { LunarWidget } from '../widgets/LunarWidget';
import { MusicWidget } from '../widgets/MusicWidget';
import { PomodoroWidget } from '../widgets/PomodoroWidget';
import { QuickActionsWidget } from '../widgets/QuickActionsWidget';
import { ReadingWidget } from '../widgets/ReadingWidget';
import { SkillWidget } from '../widgets/SkillWidget';
import { NavigatorRecentWidget, NavigatorShortcutsWidget } from '../widgets/NavigatorListWidget';
import { ShortcutsWidget } from '../widgets/ShortcutsWidget';
import { UsageWidget } from '../widgets/UsageWidget';
import { WeatherWidget } from '../widgets/WeatherWidget';
import { YearProgressWidget } from '../widgets/YearProgressWidget';
import { ClockWidget } from './ClockWidget';
import { RecentWidget } from './RecentWidget';

export type WidgetComponent = ComponentType<{ store: BoardStore; entryId?: string }>;

/** The in-process views of the home provider's own kinds, keyed by member kind. Other providers mount through `render`. */
export const WIDGET_COMPONENTS: Readonly<Record<string, WidgetComponent>> = {
	banner: Banner,
	clock: ClockWidget,
	calendar: CalendarWidget,
	lunar: LunarWidget,
	'year-progress': YearProgressWidget,
	countdown: CountdownWidget,
	anniversary: AnniversaryWidget,
	pomodoro: PomodoroWidget,
	habit: HabitWidget,
	expense: ExpenseWidget,
	reading: ReadingWidget,
	weather: WeatherWidget,
	'quick-actions': QuickActionsWidget,
	skills: SkillWidget,
	quickCapture: QuickCaptureWidget,
	fileSearch: FileSearchWidget,
	recent: RecentWidget,
	music: MusicWidget,
	album: AlbumWidget,
	usage: UsageWidget,
	'nav-recent': NavigatorRecentWidget,
	'nav-shortcuts': NavigatorShortcutsWidget,
	shortcuts: ShortcutsWidget,
};

/** Kinds whose view draws its own title row; the others get the frame's title bar. */
export const OWN_TITLE = new Set([
	'banner',
	'clock',
	'calendar',
	'lunar',
	'year-progress',
	'anniversary',
	'pomodoro',
	'habit',
	'expense',
	'reading',
	'quick-actions',
	'skills',
	'quickCapture',
	'fileSearch',
	'recent',
	'music',
	'album',
	'usage',
	'shortcuts',
	'nav-recent',
	'nav-shortcuts',
]);
