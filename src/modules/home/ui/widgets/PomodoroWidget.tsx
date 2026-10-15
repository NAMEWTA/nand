// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts (renderSidebarPomodoro)
import { lazy, Suspense, useState } from 'react';
import { useStore } from 'zustand';
import { SkipForward, Settings } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Switch } from '../../../../ui/components/switch';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import { IconButton, Choice } from '../board/controls';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { RecordDialog } from '../dialogs/RecordDialog';
import { BarChart2 } from 'lucide-react';
const Tags = lazy(() => import('../pomodoro/PomodoroTagsPanel').then((m) => ({ default: m.PomodoroTagsPanel })));
const Stats = lazy(() => import('../pomodoro/PomodoroStatsPanel').then((m) => ({ default: m.PomodoroStatsPanel })));
export function PomodoroWidget({ store, compact = false }: { store: BoardStore; compact?: boolean }) {
	useStore(store.state, (s) => s.widgetRevision);
	const [stats, setStats] = useState(false),
		[tags, setTags] = useState(false);
	const t = useT(),
		service = store.widgets.pomodoro,
		[open, setOpen] = useState(false),
		settings = useStore(store.state, (s) => s.settings);
	if (!service) return null;
	const state = service.getState(),
		displaySeconds = state.mode === 'stopwatch' ? state.elapsedSeconds : state.remainingSeconds,
		minutes = String(Math.floor(displaySeconds / 60)).padStart(2, '0'),
		seconds = String(displaySeconds % 60).padStart(2, '0');
	return (
		<>
			{tags && (
				<RecordDialog
					title={t('pomodoro.tagTitle')}
					classes="dashboard-pomodoro-stats-modal"
					onClose={() => setTags(false)}
				>
					<Suspense fallback={null}>
						<Tags service={service} close={() => setTags(false)} onChange={() => {}} />
					</Suspense>
				</RecordDialog>
			)}
			{stats && (
				<RecordDialog
					title={t('pomodoro.statsTitle')}
					classes="dashboard-pomodoro-stats-modal dashboard-pomodoro-stats-modal--wide"
					onClose={() => setStats(false)}
				>
					<Suspense fallback={null}>
						<Stats service={service} close={() => setStats(false)} />
					</Suspense>
				</RecordDialog>
			)}
			<div className="relative flex h-5 w-full items-center justify-between">
				<span className="absolute left-0 text-[.6em] text-muted-foreground">
					{t('pomodoro.today')} {service.getTodayCount()}
				</span>
				<span className="min-w-0 flex-1" />
				<Choice
					className="h-5 data-[size=sm]:h-5 w-auto max-w-[60%] border-0 bg-transparent px-1 py-0 text-[.7em] text-primary shadow-none"
					label={t('home.dashboard.activity')}
					value={service.getActivity() || '_none'}
					onChange={(value) => service.setActivity(value === '_none' ? '' : value)}
					options={[
						{ value: '_none', label: t('pomodoro.tapToSetActivity') },
						...service.getTags().map((tag) => ({ value: tag.name, label: tag.name })),
					]}
				/>
				<div className="flex min-w-0 flex-1 justify-end">
					<IconButton className="size-5" label={t('pomodoro.statsTitle')} onClick={() => setStats(true)}>
						<BarChart2 className="size-3" />
					</IconButton>
					<IconButton className="size-5" label={t('home.dashboard.settings')} onClick={() => setOpen(true)}>
						<Settings className="size-3" />
					</IconButton>
				</div>
			</div>
			<div className={`relative mx-auto flex items-center justify-center ${compact ? 'size-[62px]' : 'size-20'}`}>
				<svg width="72" height="72" viewBox="0 0 72 72" className="absolute inset-0 size-full" aria-hidden>
					<circle cx="36" cy="36" r="33" strokeWidth="6" fill="none" className="stroke-muted" />
					<circle
						cx="36"
						cy="36"
						r="33"
						strokeWidth="6"
						fill="none"
						className="stroke-primary"
						strokeLinecap="round"
						strokeDasharray={207.35}
						strokeDashoffset={207.35 * (1 - state.remainingSeconds / Math.max(1, state.totalSeconds))}
						transform="rotate(-90 36 36)"
					/>
				</svg>
				<span className={`${compact ? 'text-[.95em]' : 'text-[1.1em]'} font-bold leading-none tabular-nums`}>
					{minutes}:{seconds}
				</span>
				{state.mode !== 'stopwatch' && (
					<div
						className={`absolute left-1/2 flex -translate-x-1/2 gap-[3px] ${compact ? 'bottom-[7px]' : 'bottom-3'}`}
					>
						{Array.from({ length: settings.pomodoroLongBreakInterval }, (_, i) => (
							<span
								key={i}
								className={`size-1 rounded-full ${i < state.completedWorkSessions ? 'bg-primary' : 'bg-muted'}`}
							/>
						))}
					</div>
				)}
			</div>
			<div className="relative flex h-[var(--input-height,30px)] items-center justify-center">
				<Button
					size="xs"
					className={`h-[var(--input-height,30px)] rounded-[var(--db-radius-md)] py-0 ${compact ? 'px-[14px] text-[.7em]' : 'px-4 text-[.75em]'}`}
					onClick={() => (state.status === 'running' ? service.pause() : service.start())}
				>
					{t(state.status === 'running' ? 'home.dashboard.pause' : 'home.dashboard.focus')}
				</Button>
				<IconButton
					className="absolute left-full ml-1 size-5"
					label={t('home.dashboard.skip')}
					onClick={() => service.skip()}
				>
					<SkipForward className="size-3" />
				</IconButton>
			</div>
			{open && (
				<DashboardDialog title={t('home.dashboard.widget.pomodoro')} onClose={() => setOpen(false)}>
					<Choice
						label={t('home.dashboard.mode')}
						value={settings.pomodoroMode}
						onChange={(value) => {
							service.reset();
							void store.settings((s) => {
								s.pomodoroMode = value as 'countdown' | 'stopwatch';
							});
						}}
						options={['countdown', 'stopwatch'].map((value) => ({
							value,
							label: t(`home.dashboard.${value}`),
						}))}
					/>
					{(['pomodoroAutoStartBreak', 'pomodoroSoundEnabled', 'pomodoroMiniPanelEnabled'] as const).map(
						(key) => (
							<Label key={key} className="flex items-center gap-2">
								<Switch
									checked={settings[key]}
									onCheckedChange={(value) => {
										void store.settings((s) => {
											s[key] = value;
										});
									}}
								/>
								{t(`home.dashboard.${key}`)}
							</Label>
						),
					)}
					{(
						[
							'pomodoroWorkMinutes',
							'pomodoroShortBreakMinutes',
							'pomodoroLongBreakMinutes',
							'pomodoroLongBreakInterval',
							'pomodoroDailyGoal',
							'pomodoroRemindInterval',
						] as const
					).map((key) => (
						<Label key={key}>
							{t(`home.dashboard.${key}`)}
							<Input
								type="number"
								min={1}
								value={settings[key]}
								onChange={(e) => {
									const value = Math.max(1, +e.target.value);
									void store.settings((s) => {
										s[key] = value;
									});
								}}
							/>
						</Label>
					))}
					<Button variant="outline" onClick={() => setTags(true)}>
						{t('pomodoro.tagManage')}
					</Button>
					<Input
						aria-label={t('home.dashboard.activity')}
						defaultValue={service.getActivity()}
						onBlur={(e) => service.setActivity(e.target.value)}
					/>
				</DashboardDialog>
			)}
		</>
	);
}
