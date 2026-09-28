import { useLayoutEffect, useState } from 'preact/hooks';
import type { DashboardData, WeatherConfig, WeatherData } from '../../../core/dashboard/types/index';
import {
	fetchWeather,
	getCachedWeather,
	getWeatherDescription,
	getWeatherEmoji,
} from '../../../platform/obsidian/widgets/weather-service';
import { getLanguage, t } from '../../../shared/i18n/index';
const refreshers = new WeakMap<HTMLElement, (config: WeatherConfig) => void>();
export function refreshWeatherCards(root: HTMLElement, data: DashboardData): void {
	for (const column of data.columns)
		for (const card of column.cards) {
			if (card.type !== 'weather' || !card.weatherConfig) continue;
			const element = root.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(card.id)}"]`);
			if (element) refreshers.get(element)?.(card.weatherConfig);
		}
}
export function WeatherPanel({ config, root }: { config?: WeatherConfig; root: HTMLElement }) {
	const [current, setCurrent] = useState(config);
	const [revision, setRevision] = useState(0);
	const [weather, setWeather] = useState<WeatherData | null>(config ? getCachedWeather(config) : null);
	const [error, setError] = useState(false);
	useLayoutEffect(() => setCurrent(config), [config]);
	useLayoutEffect(() => {
		refreshers.set(root, (next) => {
			setCurrent(next);
			setRevision((value) => value + 1);
		});
		return () => refreshers.delete(root);
	}, [root]);
	useLayoutEffect(() => {
		let disposed = false;
		setError(false);
		setWeather(current ? getCachedWeather(current) : null);
		if (current && !getCachedWeather(current))
			void fetchWeather(current)
				.then((data) => {
					if (!disposed) setWeather(data);
				})
				.catch(() => {
					if (!disposed) setError(true);
				});
		return () => {
			disposed = true;
		};
	}, [current, revision]);
	if (!current) return null;
	return (
		<div class="dashboard-weather">
			{weather ? (
				<>
					<div class="dashboard-weather-current">
						<div class="dashboard-weather-temp-wrap">
							<div class="dashboard-weather-temp">{Math.round(weather.temperature)}°</div>
							<div class="dashboard-weather-icon">{getWeatherEmoji(weather.weatherCode)}</div>
						</div>
						<div class="dashboard-weather-details">
							<div class="dashboard-weather-city">{current.cityName}</div>
							<div class="dashboard-weather-desc">{getWeatherDescription(weather.weatherCode)}</div>
							<div class="dashboard-weather-wind">
								<span>{`${t('weather.feelsLike')} ${Math.round(weather.feelsLike)}°  ${t('weather.humidity')} ${Math.round(weather.humidity)}%  ${t('weather.wind')} ${Math.round(weather.windSpeed)} km/h`}</span>
							</div>
						</div>
					</div>
					{weather.dailyDates.length > 0 && (
						<div class="dashboard-weather-forecast">
							{weather.dailyDates.slice(0, 5).map((date, index) => (
								<div class="dashboard-weather-day" key={date}>
									<div class="dashboard-weather-day-name">
										{new Date(date + 'T00:00:00').toLocaleDateString(
											getLanguage() === 'zh' ? 'zh-CN' : 'en',
											{ weekday: 'short' },
										)}
									</div>
									<div class="dashboard-weather-day-icon">
										{getWeatherEmoji(weather.dailyCodes[index]!)}
									</div>
									<div class="dashboard-weather-day-temps">
										{Math.round(weather.dailyMax[index]!)}° / {Math.round(weather.dailyMin[index]!)}
										°
									</div>
								</div>
							))}
						</div>
					)}
				</>
			) : (
				<div class={error ? 'dashboard-weather-error' : 'dashboard-weather-loading'}>
					{error ? t('weather.fetchError') : '...'}
				</div>
			)}
		</div>
	);
}
