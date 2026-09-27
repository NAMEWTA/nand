import { DashboardView } from './dashboard-view';
import { refreshSidebarWeatherWidget, refreshWeatherCards } from '../renderer';
import { clearWeatherCache } from '../widgets/weather-service';

export function startWeatherRefresh(this: DashboardView): void {
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
		const root = this.containerEl.children[1] as HTMLElement | undefined;
		if (!root) return;
		if (hasWeather) refreshWeatherCards(root, this.data);
		if (hasSidebarWeather) refreshSidebarWeatherWidget(root, this.plugin.settings, this.app);
	}, DashboardView.WEATHER_REFRESH_MS);
}

export function stopWeatherRefresh(this: DashboardView): void {
	if (this.weatherRefreshTimer) {
		window.clearInterval(this.weatherRefreshTimer);
		this.weatherRefreshTimer = null;
	}
	clearWeatherCache();
}

export function startDayRolloverChecker(this: DashboardView): void {
	this.dayRolloverTimer = window.setInterval(() => this.checkDayRollover(), DashboardView.DAY_ROLLOVER_CHECK_MS);
}

export function stopDayRolloverChecker(this: DashboardView): void {
	if (this.dayRolloverTimer) {
		window.clearInterval(this.dayRolloverTimer);
		this.dayRolloverTimer = null;
	}
}

export function checkDayRollover(this: DashboardView): void {
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
