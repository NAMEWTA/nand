import type { App, TFile } from 'obsidian';
import type { HomeWidgetContext } from '../../api';
import type { DashboardSettings } from '../../core/board/types/model';
import type { HolidayInfo } from '../../platform/calendar/holiday-service';
import type { PomodoroService } from '../../platform/pomodoro/pomodoro-service';
import type { ReadingService } from '../../platform/reading/reading-service';
import type { DashboardSettingsAccess } from '../settings-access';

export interface BuiltinWidgetEnvironment {
	app: App;
	settings: DashboardSettings;
	settingsAccess?: DashboardSettingsAccess;
	pomodoro?: PomodoroService;
	reading?: ReadingService;
	holidayData?: Record<string, HolidayInfo>;
	calendarAutoLoad?: boolean;
	openNote?: (file: TFile, line?: number) => void;
	renderQuickActions?: (host: HTMLElement) => void;
	renderSkills?: (host: HTMLElement, context: HomeWidgetContext) => void;
}
const environments = new WeakMap<HomeWidgetContext, BuiltinWidgetEnvironment>();
export function bindBuiltinWidgetEnvironment(context: HomeWidgetContext, environment: BuiltinWidgetEnvironment): void { environments.set(context, environment); }
export function builtinWidgetEnvironment(context: HomeWidgetContext): BuiltinWidgetEnvironment {
	const environment = environments.get(context);
	if (!environment) throw new Error('home.widget.unavailable');
	return environment;
}
