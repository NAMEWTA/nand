// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/settings.ts
import { WidgetBackgroundEditor } from './WidgetBackgroundEditor';
import { SkillList } from '../quickbar/SkillList';
import { useState } from 'react';
import { Input } from '../../../../ui/components/input';
import { Textarea } from '../../../../ui/components/textarea';
import { Button } from '../../../../ui/components/button';
import { SettingsSection } from '../../../../ui/components/nand/SettingsSection';
import { SettingsRow } from '../../../../ui/components/nand/SettingsRow';
import { SettingsSwitchRow } from '../../../../ui/components/nand/SettingsSwitchRow';
import { useT } from '../../../../ui/react/hooks';
import type { HomeHost } from '../../services/home-host';
import type { DashboardSettings } from '../../core/board/types';
import { backupBoards, restoreLatestBackup } from '../../services/board-backups';
import { geocodeCity, type GeocodeResult } from '../../platform/widgets/weather-service';
import { Choice } from '../board/controls';
import { DashboardDialog } from '../dialogs/DashboardDialog';
type Props = {
	host: HomeHost;
	settings: DashboardSettings;
	update: (update: (s: DashboardSettings) => void) => Promise<void>;
};
export function GeneralExtras({ host, settings, update }: Props) {
	const t = useT(),
		[error, setError] = useState(''),
		[restore, setRestore] = useState(false);
	const run = (task: () => Promise<void>) => {
		void task().catch((e) => setError(String(e)));
	};
	return (
		<SettingsSection title={t('home.p1.otherSettings')}>
			<SettingsRow label={t('home.p1.language')} control={<span>{t('home.p1.followNand')}</span>} />
			<SettingsRow
				label={t('settings.taskArchiveTarget')}
				control={
					<Choice
						label={t('settings.taskArchiveTarget')}
						value={settings.taskArchiveTarget}
						options={['file', 'daily'].map((value) => ({ value, label: t(`home.p1.target.${value}`) }))}
						onChange={(value) =>
							run(() =>
								update((s) => {
									s.taskArchiveTarget = value as 'file' | 'daily';
								}),
							)
						}
					/>
				}
			/>
			<SettingsRow
				label={t('home.p1.rssRetention')}
				control={
					<Input
						type="number"
						min={1}
						value={settings.rssReadRetentionDays}
						onChange={(e) =>
							run(() =>
								update((s) => {
									s.rssReadRetentionDays = Math.max(1, +e.target.value);
								}),
							)
						}
					/>
				}
			/>
			<SettingsSwitchRow
				label={t('home.p1.backup')}
				checked={settings.backupEnabled}
				onChange={() =>
					run(() =>
						update((s) => {
							s.backupEnabled = !s.backupEnabled;
						}),
					)
				}
			/>
			<SettingsRow
				label={t('home.p1.backupPeriod')}
				control={
					<Choice
						label={t('home.p1.backupPeriod')}
						value={settings.backupPeriod}
						options={['daily', 'weekly'].map((value) => ({ value, label: t(`home.p1.${value}`) }))}
						onChange={(value) =>
							run(() =>
								update((s) => {
									s.backupPeriod = value as 'daily' | 'weekly';
								}),
							)
						}
					/>
				}
			/>
			<SettingsRow
				label={t('home.p1.backupCount')}
				control={
					<Input
						type="number"
						min={1}
						max={100}
						value={settings.backupMaxCount}
						onChange={(e) =>
							run(() =>
								update((s) => {
									s.backupMaxCount = Math.max(1, Math.min(100, +e.target.value));
								}),
							)
						}
					/>
				}
			/>
			<div className="flex gap-2">
				<Button variant="outline" onClick={() => run(() => backupBoards(host))}>
					{t('home.p1.backupNow')}
				</Button>
				<Button variant="outline" onClick={() => setRestore(true)}>
					{t('home.p1.restore')}
				</Button>
			</div>
			{error && <p role="alert">{error}</p>}
			{restore && (
				<DashboardDialog title={t('home.p1.restore')} onClose={() => setRestore(false)}>
					<p>{t('home.p1.restoreConfirm')}</p>
					<Button
						onClick={() =>
							run(async () => {
								await restoreLatestBackup(host);
								setRestore(false);
							})
						}
					>
						{t('home.p1.restore')}
					</Button>
				</DashboardDialog>
			)}
		</SettingsSection>
	);
}
export function WidgetExtras({ host, settings, update }: Props) {
	const t = useT(),
		[cities, setCities] = useState<GeocodeResult[]>([]),
		[query, setQuery] = useState(settings.widgetWeatherCity),
		[error, setError] = useState('');
	const set = (change: (s: DashboardSettings) => void) => {
		void update(change).catch((e) => setError(String(e)));
	};
	const numbers = [
		['pomodoroWorkMinutes', 1, 180],
		['pomodoroShortBreakMinutes', 1, 60],
		['pomodoroLongBreakMinutes', 1, 120],
		['pomodoroLongBreakInterval', 1, 20],
		['pomodoroDailyGoal', 1, 50],
		['pomodoroRemindInterval', 1, 240],
	] as const;
	return (
		<div className="space-y-6">
			<SettingsSection title={t('home.dashboard.widget.weather')}>
				<SettingsRow
					label={t('settings.widgetWeatherCity')}
					control={
						<div className="flex gap-2">
							<Input
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								onBlur={() =>
									set((s) => {
										s.widgetWeatherCity = query.trim();
									})
								}
								aria-label={t('settings.widgetWeatherCity')}
							/>
							<Button
								variant="outline"
								onClick={() => {
									void geocodeCity(query)
										.then(setCities)
										.catch((e) => setError(String(e)));
								}}
							>
								{t('home.p1.search')}
							</Button>
						</div>
					}
				/>
				{cities.map((city) => (
					<Button
						variant="ghost"
						key={`${city.latitude}:${city.longitude}`}
						onClick={() => {
							set((s) => {
								s.widgetWeatherCity = city.name;
								s.widgetWeatherLat = city.latitude;
								s.widgetWeatherLon = city.longitude;
							});
							setCities([]);
							setQuery(city.name);
						}}
					>
						{city.name} {city.country}
					</Button>
				))}
			</SettingsSection>
			<SettingsSection title={t('home.dashboard.widget.pomodoro')}>
				{numbers.map(([key, min, max]) => (
					<SettingsRow
						key={key}
						label={t(`home.p1.${key}`)}
						control={
							<Input
								type="number"
								min={min}
								max={max}
								value={settings[key]}
								onChange={(e) =>
									set((s) => {
										s[key] = Math.max(min, Math.min(max, +e.target.value));
									})
								}
							/>
						}
					/>
				))}
				{(['pomodoroAutoStartBreak', 'pomodoroSoundEnabled', 'pomodoroMiniPanelEnabled'] as const).map(
					(key) => (
						<SettingsSwitchRow
							key={key}
							label={t(`home.p1.${key}`)}
							checked={settings[key]}
							onChange={() =>
								set((s) => {
									s[key] = !s[key];
								})
							}
						/>
					),
				)}
				<SettingsRow
					label={t('home.p1.pomodoroMode')}
					control={
						<Choice
							label={t('home.p1.pomodoroMode')}
							value={settings.pomodoroMode}
							options={['countdown', 'stopwatch'].map((value) => ({
								value,
								label: t(`home.p1.${value}`),
							}))}
							onChange={(value) =>
								set((s) => {
									s.pomodoroMode = value as 'countdown' | 'stopwatch';
								})
							}
						/>
					}
				/>
			</SettingsSection>
			<SettingsSection title={t('home.dashboard.widget.calendar')}>
				<SettingsRow
					label={t('exclude.folders')}
					control={
						<Textarea
							value={settings.calendarExcludeFolders.join('\n')}
							onChange={(e) =>
								set((s) => {
									s.calendarExcludeFolders = e.target.value.split('\n').filter(Boolean);
								})
							}
						/>
					}
				/>
				<SettingsRow
					label={t('home.p1.taskTarget')}
					control={
						<Choice
							label={t('home.p1.taskTarget')}
							value={settings.calendarTaskTarget?.kind ?? 'daily'}
							options={['daily', 'file', 'folder', 'task'].map((value) => ({
								value,
								label: t(`home.p1.target.${value}`),
							}))}
							onChange={(value) =>
								set((s) => {
									s.calendarTaskTarget =
										value === 'daily'
											? undefined
											: {
													kind: value as 'file' | 'folder' | 'task',
													path: s.calendarTaskTarget?.path ?? '',
												};
								})
							}
						/>
					}
				/>
				{settings.calendarTaskTarget && (
					<>
						<SettingsRow
							label={t('home.dashboard.path')}
							control={
								<Input
									value={settings.calendarTaskTarget.path}
									onChange={(e) =>
										set((s) => {
											if (s.calendarTaskTarget) s.calendarTaskTarget.path = e.target.value;
										})
									}
								/>
							}
						/>
						{settings.calendarTaskTarget.kind === 'task' && (
							<SettingsRow
								label={t('home.dashboard.template')}
								control={
									<Input
										value={settings.calendarTaskTarget.template ?? ''}
										onChange={(e) =>
											set((s) => {
												if (s.calendarTaskTarget)
													s.calendarTaskTarget.template = e.target.value;
											})
										}
									/>
								}
							/>
						)}
					</>
				)}
				<SettingsRow
					label={t('home.p1.taskPosition')}
					control={
						<Choice
							label={t('home.p1.taskPosition')}
							value={settings.calendarTaskInsertPosition}
							options={['start', 'end'].map((value) => ({ value, label: t(`home.p1.${value}`) }))}
							onChange={(value) =>
								set((s) => {
									s.calendarTaskInsertPosition = value as 'start' | 'end';
								})
							}
						/>
					}
				/>
			</SettingsSection>
			<SettingsSection title={t('home.dashboard.widget.countdown')}>
				{settings.countdowns.map((c) => (
					<div className="grid gap-2 rounded border p-3" key={c.id}>
						<Input
							aria-label={t('home.dashboard.name')}
							value={c.label}
							onChange={(e) =>
								set((s) => {
									const v = s.countdowns.find((x) => x.id === c.id);
									if (v) v.label = e.target.value;
								})
							}
						/>
						<Choice
							label={t('countdown.displayMode')}
							value={c.displayMode}
							options={['days', 'hours', 'minutes'].map((value) => ({
								value,
								label: t(`countdown.${value}`),
							}))}
							onChange={(value) =>
								set((s) => {
									const entry = s.countdowns.find((x) => x.id === c.id);
									if (entry) entry.displayMode = value as typeof entry.displayMode;
								})
							}
						/>
						<Input
							type="datetime-local"
							aria-label={t('home.p1.date')}
							value={c.targetDate.length === 10 ? `${c.targetDate}T00:00` : c.targetDate}
							onChange={(e) =>
								set((s) => {
									const v = s.countdowns.find((x) => x.id === c.id);
									if (v) v.targetDate = e.target.value;
								})
							}
						/>
						<Input
							type="number"
							min={0}
							aria-label={t('home.p1.reminderDays')}
							value={c.reminderDays}
							onChange={(e) =>
								set((s) => {
									const v = s.countdowns.find((x) => x.id === c.id);
									if (v) v.reminderDays = +e.target.value;
								})
							}
						/>
						<WidgetBackgroundEditor
							app={host.app}
							value={c.background}
							onChange={(background) =>
								set((s) => {
									const entry = s.countdowns.find((x) => x.id === c.id);
									if (entry) entry.background = background;
								})
							}
						/>
						<Button
							variant="ghost"
							onClick={() =>
								set((s) => {
									s.countdowns = s.countdowns.filter((x) => x.id !== c.id);
								})
							}
						>
							{t('common.delete')}
						</Button>
					</div>
				))}
				<Button
					variant="outline"
					onClick={() =>
						set((s) => {
							s.countdowns.push({
								id: crypto.randomUUID(),
								label: '',
								targetDate: new Date().toISOString().slice(0, 16),
								displayMode: 'days',
								reminderDays: 0,
							});
						})
					}
				>
					{t('common.add')}
				</Button>
			</SettingsSection>
			<SettingsSection title={t('home.p1.widgetAppearance')}>
				<p className="text-sm text-muted-foreground">{t('home.p1.sidebarWidthHint')}</p>
				{(
					[
						'quickActionsBackground',
						'pomodoroBackground',
						'habitBackground',
						'yearProgressBackground',
					] as const
				).map((key) => (
					<SettingsRow
						key={key}
						label={t(`home.p1.${key}`)}
						control={
							<WidgetBackgroundEditor
								app={host.app}
								value={settings[key]}
								onChange={(value) =>
									set((s) => {
										s[key] = value;
									})
								}
							/>
						}
					/>
				))}
			</SettingsSection>
			<SettingsSection title={t('home.dashboard.widget.skills')}>
				<SkillList
					skills={settings.skillWidgetButtons}
					onChange={(skills) =>
						set((s) => {
							s.skillWidgetButtons = skills;
						})
					}
				/>
			</SettingsSection>
			{error && <p role="alert">{error}</p>}
		</div>
	);
}
