import { useLayoutEffect, useState } from 'preact/hooks';
import type { DashboardSettings, WeatherData } from '../../core/board/types/index';
import {
	fetchWeather,
	getCachedWeather,
	getWeatherDescription,
	getWeatherEmoji,
} from '../../platform/widgets/weather-service';
import { getLanguage, t } from '../../../../shared/i18n/index';
export function SidebarWeatherPanel({ settings, revision }: { settings: DashboardSettings; revision: number }) {
	const config = {
		latitude: settings.widgetWeatherLat || 31.23,
		longitude: settings.widgetWeatherLon || 121.47,
		cityName: settings.widgetWeatherCity || 'Shanghai',
	};
	const [data, setData] = useState<WeatherData | null>(() => getCachedWeather(config));
	const [error, setError] = useState(false);
	useLayoutEffect(() => {
		let disposed = false;
		const cached = getCachedWeather(config);
		setData(cached);
		setError(false);
		if (!cached)
			void fetchWeather(config)
				.then((value) => {
					if (!disposed) setData(value);
				})
				.catch(() => {
					if (!disposed) setError(true);
				});
		return () => {
			disposed = true;
		};
	}, [config.latitude, config.longitude, config.cityName, revision]);
	if (!data)
		return (
			<div class={error ? 'dashboard-sidebar-weather-error' : 'dashboard-sidebar-weather-loading'}>
				{error ? '--' : '...'}
			</div>
		);
	return (
		<>
			<div class="dashboard-sidebar-weather-top">
				<div class="dashboard-sidebar-weather-icon">{getWeatherEmoji(data.weatherCode)}</div>
				<div class="dashboard-sidebar-weather-temp-wrap">
					<div class="dashboard-sidebar-weather-temp">{Math.round(data.temperature)}°</div>
				</div>
			</div>
			<div class="dashboard-sidebar-weather-info">
				<div class="dashboard-sidebar-weather-city">{config.cityName}</div>
				<div class="dashboard-sidebar-weather-desc-line">
					<span class="dashboard-sidebar-weather-desc">{getWeatherDescription(data.weatherCode)}</span>
				</div>
			</div>
			<div class="dashboard-sidebar-weather-details">
				<div class="dashboard-sidebar-weather-detail">
					{t('weather.feelsLike')} {Math.round(data.feelsLike)}°
				</div>
				<div class="dashboard-sidebar-weather-detail">
					{t('weather.humidity')} {Math.round(data.humidity)}%
				</div>
				<div class="dashboard-sidebar-weather-detail">{Math.round(data.windSpeed)} km/h</div>
			</div>
			{data.dailyDates.length > 1 && (
				<div class="dashboard-sidebar-weather-forecast">
					{data.dailyDates.slice(0, 5).map((date, index) => (
						<div class="dashboard-sidebar-weather-fday" key={date}>
							<div class="dashboard-sidebar-weather-fday-name">
								{index === 0
									? t('weather.today')
									: new Date(date + 'T00:00:00').toLocaleDateString(
											getLanguage() === 'zh' ? 'zh-CN' : 'en',
											{ weekday: 'short' },
										)}
							</div>
							<div class="dashboard-sidebar-weather-fday-icon">
								{getWeatherEmoji(data.dailyCodes[index]!)}
							</div>
							<div class="dashboard-sidebar-weather-fday-temps">
								<span class="dashboard-sidebar-weather-fday-high">
									{Math.round(data.dailyMax[index]!)}°
								</span>
								<span class="dashboard-sidebar-weather-fday-low">
									{Math.round(data.dailyMin[index]!)}°
								</span>
							</div>
						</div>
					))}
				</div>
			)}
		</>
	);
}
