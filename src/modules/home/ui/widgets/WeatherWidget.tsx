// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts (renderSidebarWeather)
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { Settings } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { useT } from '../../../../ui/react/hooks';
import { useOwnerDocument, useVisible } from '../../../../ui/react/contexts';
import type { BoardStore } from '../../services/board-store';
import { getWeatherDescription, getWeatherEmoji, type GeocodeResult } from '../../platform/widgets/weather-service';
import { IconButton } from '../board/controls';
import { DashboardDialog } from '../dialogs/DashboardDialog';
export function WeatherWidget({ store }: { store: BoardStore }) {
	const { weather, weatherError, settings } = useStore(store.state),
		t = useT(),
		doc = useOwnerDocument(),
		visible = useVisible(),
		[open, setOpen] = useState(false),
		[query, setQuery] = useState(''),
		[cities, setCities] = useState<GeocodeResult[]>([]);
	useEffect(() => {
		const win = doc.defaultView;
		if (!visible || !win) return;
		void store.weather();
		const timer = win.setInterval(() => {
			void store.weather();
		}, 1800000);
		return () => win.clearInterval(timer);
	}, [store, visible, doc, settings.widgetWeatherLat, settings.widgetWeatherLon]);
	useEffect(() => {
		const win = doc.defaultView;
		if (!visible || !open || !query.trim() || !win) return;
		let active = true;
		const timer = win.setTimeout(() => {
			void store
				.cities(query)
				.then((result) => {
					if (active) setCities(result);
				})
				.catch(() => {
					if (active) setCities([]);
				});
		}, 300);
		return () => {
			active = false;
			win.clearTimeout(timer);
		};
	}, [store, doc, query, open, visible]);
	return (
		<>
			<div className="flex items-center justify-between text-xs">
				<span>{settings.widgetWeatherCity}</span>
				<IconButton label={t('home.dashboard.settings')} onClick={() => setOpen(true)}>
					<Settings className="size-3" />
				</IconButton>
			</div>
			{weather ? (
				<>
					<div className="my-2 flex items-center justify-between">
						<strong className="text-3xl font-light">{Math.round(weather.temperature)}°</strong>
						<span className="text-3xl">{getWeatherEmoji(weather.weatherCode)}</span>
					</div>
					<div className="text-center text-xs text-muted-foreground">
						{getWeatherDescription(weather.weatherCode)}
					</div>
					<div className="my-2 flex justify-around gap-1 text-[.6em] text-muted-foreground">
						<span>
							{t('home.dashboard.feelsLike')} {weather.feelsLike}°
						</span>
						<span>{weather.humidity}%</span>
						<span>{weather.windSpeed} km/h</span>
					</div>
					<div className="grid grid-cols-5 gap-1 text-center text-[.6em]">
						{weather.dailyDates.slice(0, 5).map((date, i) => (
							<div key={date} className="grid gap-1">
								<span>
									{new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })}
								</span>
								<span>{getWeatherEmoji(weather.dailyCodes[i] ?? 0)}</span>
								<span>
									{Math.round(weather.dailyMax[i] ?? 0)}°/{Math.round(weather.dailyMin[i] ?? 0)}°
								</span>
							</div>
						))}
					</div>
				</>
			) : (
				<p role="status" className="text-xs text-muted-foreground">
					{weatherError || t('home.dashboard.loading')}
				</p>
			)}
			{open && (
				<DashboardDialog title={t('home.dashboard.widget.weather')} onClose={() => setOpen(false)}>
					<Input
						value={query}
						aria-label={t('home.dashboard.city')}
						placeholder={t('home.dashboard.city')}
						onChange={(e) => setQuery(e.target.value)}
					/>
					{cities.map((city) => (
						<Button
							key={`${city.latitude}:${city.longitude}`}
							variant="ghost"
							onClick={() => {
								void store
									.settings((s) => {
										s.widgetWeatherCity = city.name;
										s.widgetWeatherLat = city.latitude;
										s.widgetWeatherLon = city.longitude;
									})
									.then(() => setOpen(false));
							}}
						>
							{city.name} {city.country}
						</Button>
					))}
				</DashboardDialog>
			)}
		</>
	);
}
