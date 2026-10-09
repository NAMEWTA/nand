import { SaveStatus } from '../../../../ui/primitives/SaveStatus';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { DashboardSettings } from '../../core/board/types/index';
import { activityColor, type PomodoroService } from '../../platform/pomodoro/pomodoro-service';
import { t } from '../../../../shared/i18n/index';
import { Icon } from '../../../../ui/primitives/Icon';
import { formatTimer } from '../reading/ReadingPanel';
import { useService } from '../widgets/use-service';
function Activity({ service }: { service: PomodoroService }) {
	const [open, setOpen] = useState(false),
		[activity, setActivity] = useState(service.getActivity());
	const wrap = useRef<HTMLDivElement>(null),
		input = useRef<HTMLInputElement>(null);
	useLayoutEffect(() => {
		if (!open || !wrap.current) return;
		input.current?.focus();
		const doc = wrap.current.ownerDocument;
		const close = (event: MouseEvent) => {
			if (!wrap.current?.contains(event.target as Node)) setOpen(false);
		};
		doc.addEventListener('click', close);
		return () => doc.removeEventListener('click', close);
	}, [open]);
	const select = (value: string) => {
		service.setActivity(value);
		setActivity(value);
		setOpen(false);
	};
	return (
		<div ref={wrap} class="dashboard-pomodoro-activity-selector">
			<div
				class={`dashboard-pomodoro-activity-trigger${activity ? ' dashboard-pomodoro-activity-trigger--set' : ''}`}
				role="button"
				tabIndex={0}
				onClick={() => setOpen(!open)}
			>
				{activity ? (
					<>
						<div
							class="dashboard-pomodoro-activity-color-dot"
							style={{ backgroundColor: activityColor(activity) }}
						/>
						<span>{activity}</span>
					</>
				) : (
					<span class="dashboard-pomodoro-activity-placeholder">{t('pomodoro.tapToSetActivity')}</span>
				)}
			</div>
			{open && (
				<div class="dashboard-pomodoro-activity-panel">
					<input
						ref={input}
						class="dashboard-pomodoro-activity-panel-input"
						type="text"
						placeholder={t('pomodoro.inputActivity')}
						onKeyDown={(event) => {
							if (event.key === 'Enter' && !event.isComposing) {
								event.preventDefault();
								const value = event.currentTarget.value.trim();
								if (value) select(value);
								else setOpen(false);
							} else if (event.key === 'Escape') setOpen(false);
						}}
					/>
					{service.getRecentActivities(6).length > 0 && (
						<div class="dashboard-pomodoro-activity-chips">
							{service.getRecentActivities(6).map((name) => (
								<div
									key={name}
									role="button"
									tabIndex={0}
									class="dashboard-pomodoro-activity-chip"
									onClick={() => select(name)}
								>
									<div
										class="dashboard-pomodoro-activity-color-dot"
										style={{ backgroundColor: activityColor(name) }}
									/>
									<span>{name}</span>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
export function PomodoroPanel({
	service,
	settings,
	statistics,
	background,
}: {
	service: PomodoroService;
	settings: DashboardSettings;
	statistics: () => void;
	background?: () => void;
}) {
	useService(service);
	const state = service.getState(),
		running = state.status === 'running',
		standby = state.status === 'paused' && state.remainingSeconds === state.totalSeconds;
	const circumference = 2 * Math.PI * 33;
	return (
		<>
			<SaveStatus source={service} showSaved={false} />
			<div class="dashboard-sidebar-pomodoro-top">
				<div class="dashboard-sidebar-pomodoro-stats-hint">
					🍅 {t('pomodoro.today')} {service.getTodayCount()}
				</div>
				<Activity service={service} />
				{background && (
					<div
						class="dashboard-widget-inline-cfg-btn"
						role="button"
						tabIndex={0}
						aria-label={t('wbg.title')}
						onClick={background}
					>
						<Icon name="settings" />
					</div>
				)}
				<div class="dashboard-sidebar-pomodoro-stats-btn" role="button" tabIndex={0} aria-label={t('pomodoro.statsTitle')} onClick={statistics}>
					<Icon name="bar-chart-2" />
				</div>
			</div>
			<div class="dashboard-sidebar-pomodoro-ring-wrap">
				<svg class="dashboard-sidebar-pomodoro-ring" viewBox="0 0 72 72" width="72" height="72">
					<circle
						class="dashboard-sidebar-pomodoro-ring-bg"
						cx={36}
						cy={36}
						r={33}
						stroke-width={6}
						fill="none"
					/>
					<circle
						class="dashboard-sidebar-pomodoro-ring-progress"
						cx={36}
						cy={36}
						r={33}
						stroke-width={6}
						fill="none"
						stroke-linecap="round"
						stroke-dasharray={circumference}
						stroke-dashoffset={
							circumference *
							(1 - (state.totalSeconds > 0 ? state.remainingSeconds / state.totalSeconds : 1))
						}
						transform="rotate(-90 36 36)"
					/>
				</svg>
				<div class="dashboard-sidebar-pomodoro-time">{formatTimer(state.remainingSeconds)}</div>
				<div class="dashboard-sidebar-pomodoro-dots">
					{Array.from({ length: settings.pomodoroLongBreakInterval }, (_, index) => (
						<div
							key={index}
							class={`dashboard-sidebar-pomodoro-dot${index < state.completedWorkSessions ? ' dashboard-sidebar-pomodoro-dot--filled' : ''}`}
						/>
					))}
				</div>
			</div>
			<button
				class={`dashboard-sidebar-pomodoro-main-btn${running ? ' dashboard-sidebar-pomodoro-main-btn--running' : ''}`}
				onClick={() => {
					if (running) service.reset();
					else service.start();
				}}
			>
				{t(
					running
						? 'pomodoro.stop'
						: standby
							? state.phase === 'work'
								? 'pomodoro.resumeFocus'
								: 'pomodoro.startBreak'
							: 'pomodoro.startFocus',
				)}
			</button>
		</>
	);
}
