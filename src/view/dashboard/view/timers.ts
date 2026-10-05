import { clearWeatherCache } from '../../../platform/obsidian/widgets/weather-service';
import { refreshWeatherCards } from '../cards/WeatherPanel';
import { refreshSidebarWeatherWidget } from '../renderer/refresh-sidebar-weather-widget';
import type { DashboardSurface } from './dashboard-surface';
import { DAY_ROLLOVER_CHECK_MS, WEATHER_REFRESH_MS } from './timing';

export function startWeatherRefresh(this: DashboardSurface): void {
	this.weatherRefreshTimer = window.setInterval(() => {
		if (!this.data) return;
		const hasWeather = this.data.columns.some((col) => col.cards.some((c) => c.type === 'weather'));
		// The sidebar weather widget DOM is preserved across re-renders, so it
		// no longer refreshes as a side effect of re-renders - pull it into the
		// same periodic refresh. The widget renders through the weather cache,
		// so this only refetches once the TTL has lapsed.
		const hasSidebarWeather = this.plugin.settings.widgetWeatherEnabled;
		if (!hasWeather && !hasSidebarWeather) return;
		// Refresh in place instead of rebuilding the whole dashboard. Full
		// render() here was the main source of periodic jank on mobile - it
		// emptied and rebuilt every card/section.
		clearWeatherCache();
		const root = this.contentEl;
		if (!root) return;
		if (hasWeather) refreshWeatherCards(root, this.data);
		if (hasSidebarWeather) refreshSidebarWeatherWidget(root, this.plugin.settings, this.app);
	}, WEATHER_REFRESH_MS);
}

export function stopWeatherRefresh(this: DashboardSurface): void {
	if (this.weatherRefreshTimer) {
		window.clearInterval(this.weatherRefreshTimer);
		this.weatherRefreshTimer = null;
	}
	clearWeatherCache();
}

export function startDayRolloverChecker(this: DashboardSurface): void {
	this.dayRolloverTimer = window.setInterval(() => this.checkDayRollover(), DAY_ROLLOVER_CHECK_MS);
}

export function stopDayRolloverChecker(this: DashboardSurface): void {
	if (this.dayRolloverTimer) {
		window.clearInterval(this.dayRolloverTimer);
		this.dayRolloverTimer = null;
	}
}

export function checkDayRollover(this: DashboardSurface): void {
	if (!this.data) return;
	const todayKey = new Date().toDateString();
	if (todayKey === this.lastRenderedDay) return;

	this.lastRenderedDay = todayKey;
	// Invalidate the widget signature so the preserved widgets DOM is rebuilt:
	// date-dependent widgets (lunar, year progress, countdown values, task
	// calendar) must recompute for the new day.
	this.sidebarWidgetsSig = null;
	this.render(this.data);
}
