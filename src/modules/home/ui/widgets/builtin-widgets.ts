import type { HomeWidgetContext } from '../../api';
import type { WidgetBackground } from '../../core/board/types/model';
import { renderSidebarCalendar } from '../calendar/calendar-widget';
import { renderSidebarExpenseWidget } from '../expense/expense-widget';
import { renderSidebarHabitWidget } from '../habit/habit-widget';
import { renderSidebarMusicWidget } from '../music/music-widget';
import { renderSidebarPomodoro, renderSidebarWeather } from '../renderer/refresh-sidebar-weather-widget';
import { renderSidebarCountdown, renderSidebarReading } from '../renderer/render-sidebar-countdown';
import { renderSidebarAlbumWidget } from './album-widget';
import { renderSidebarAnniversaryWidget } from './anniversary-widget';
import { builtinWidgetEnvironment } from './builtin-context';
import { renderSidebarLunarWidget } from './lunar-widget';
import { appendInlineBackgroundButton, applyWidgetBackground } from './widget-background';
import { renderSidebarYearProgress } from './year-progress-widget';

/** Provider adapter only: membership, order and enable flags belong to the board host. */
export function renderBuiltinWidget(kind: string, host: HTMLElement, context: HomeWidgetContext): void {
	const env = builtinWidgetEnvironment(context);
	const { app, settings, settingsAccess } = env;
	const background = (key: 'quickActionsBackground' | 'pomodoroBackground' | 'habitBackground' | 'musicBackground' | 'yearProgressBackground') =>
		(bg: WidgetBackground | undefined) => { void settingsAccess?.updateSettings(current => ({ ...current, [key]: bg })); };
	switch (kind) {
		case 'skills':
			if (!env.renderSkills) throw new Error('home.widget.unavailable');
			env.renderSkills(host, context); break;
		case 'calendar': renderSidebarCalendar(host, settings, app, env.openNote, { autoLoad: env.calendarAutoLoad }, settingsAccess); break;
		case 'lunar': renderSidebarLunarWidget(host, env.holidayData ?? {}, app); break;
		case 'weather': renderSidebarWeather(host, settings, app); break;
		case 'year-progress': renderSidebarYearProgress(host, settings.yearProgressBackground, app, background('yearProgressBackground')); break;
		case 'habit': renderSidebarHabitWidget(host, app, settings.habitBackground, background('habitBackground')); break;
		case 'expense': renderSidebarExpenseWidget(host, app); break;
		case 'music': renderSidebarMusicWidget(host, settings.musicBackground, app, background('musicBackground')); break;
		case 'pomodoro':
			if (!env.pomodoro) throw new Error('home.widget.unavailable');
			renderSidebarPomodoro(host, env.pomodoro, settings, app, background('pomodoroBackground')); break;
		case 'reading':
			if (!env.reading) throw new Error('home.widget.unavailable');
			renderSidebarReading(host, env.reading); break;
		case 'album': {
			const cfg = settings.albums.find(item => String(item.id) === context.instanceId);
			if (!cfg) throw new Error('home.widget.instanceMissing');
			renderSidebarAlbumWidget(host, { ...settings, widgetAlbumFolder: cfg.folder, widgetAlbumIntervalSec: cfg.intervalSec, widgetAlbumRecursive: cfg.recursive, widgetAlbumRatio: cfg.ratio, widgetAlbumTransition: cfg.transition }, app, cfg,
				focal => { void settingsAccess?.updateSettings(current => ({ ...current, albums: current.albums.map(item => item.id === cfg.id ? { ...item, focal } : item) })); });
			host.querySelector<HTMLElement>('.dashboard-sidebar-album')?.setAttribute('data-album-id', String(cfg.id));
			break;
		}
		case 'anniversary': {
			const cfg = settings.anniversaries.find(item => item.id === context.instanceId);
			if (!cfg) throw new Error('home.widget.instanceMissing');
			renderSidebarAnniversaryWidget(host, cfg, app, updated => { void settingsAccess?.updateSettings(current => ({ ...current, anniversaries: current.anniversaries.map(item => item.id === updated.id ? updated : item) })); });
			break;
		}
		case 'countdown': {
			const cfg = settings.countdowns.find(item => item.id === context.instanceId);
			if (!cfg) throw new Error('home.widget.instanceMissing');
			renderSidebarCountdown(host, cfg, app, settingsAccess); break;
		}
		case 'quick-actions': {
			if (!env.renderQuickActions) throw new Error('home.widget.unavailable');
			env.renderQuickActions(host);
			const root = host.firstElementChild as HTMLElement | null;
			if (!root) break;
			root.addClass('dashboard-sidebar-widget');
			applyWidgetBackground(root, settings.quickActionsBackground, app, { skipFrame: true });
			const buttons = root.querySelector<HTMLElement>('.dashboard-qa-btn-group');
			if (buttons) {
				const gear = appendInlineBackgroundButton(buttons, app, settings.quickActionsBackground, background('quickActionsBackground'));
				buttons.insertBefore(gear, buttons.firstChild);
			}
			break;
		}
		default: throw new Error('home.widget.unavailable');
	}
}
