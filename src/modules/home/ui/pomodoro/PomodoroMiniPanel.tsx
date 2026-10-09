import { useLayoutEffect } from 'preact/hooks';
import type { PomodoroService } from '../../platform/pomodoro/pomodoro-service';
import { t } from '../../../../shared/i18n';
import { Icon } from '../../../../ui/primitives/Icon';
export function PomodoroMiniContent({
	service,
	root,
	hide,
}: {
	service: PomodoroService;
	root: HTMLElement;
	hide: () => void;
}) {
	const state = service.getState(),
		paused = state.status === 'paused',
		radius = 12.75,
		circumference = 2 * Math.PI * radius,
		progress = state.totalSeconds > 0 ? state.remainingSeconds / state.totalSeconds : 1;
	useLayoutEffect(() => {
		const win = root.ownerDocument.defaultView!;
		let timer: number | undefined;
		const arm = () => {
			if (timer !== undefined) win.clearTimeout(timer);
			root.removeClass('dashboard-pomodoro-mini--silent');
			timer = win.setTimeout(() => root.addClass('dashboard-pomodoro-mini--silent'), 10000);
		};
		const events = ['pointerenter', 'pointerdown', 'pointermove', 'click', 'focusin'] as const;
		for (const event of events) root.addEventListener(event, arm);
		arm();
		return () => {
			if (timer !== undefined) win.clearTimeout(timer);
			for (const event of events) root.removeEventListener(event, arm);
		};
	}, [root]);
	const toggle = () => {
		if (service.getState().status === 'running') service.pause();
		else service.start();
	};
	const button = (name: string, label: string, action: () => void, ghost = false) => (
		<div
			class={`dashboard-pomodoro-mini-btn${ghost ? ' dashboard-pomodoro-mini-btn--ghost' : ''}`}
			role="button"
			tabIndex={0}
			aria-label={t(label)}
			title={t(label)}
			onClick={action}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					action();
				}
			}}
		>
			<Icon name={name} />
		</div>
	);
	return (
		<>
			<div class="dashboard-pomodoro-mini-ring-wrap">
				<svg class="dashboard-pomodoro-mini-ring" viewBox="0 0 28 28" width="28" height="28">
					<circle
						class="dashboard-pomodoro-mini-ring-bg"
						cx="14"
						cy="14"
						r={radius}
						stroke-width="2.5"
						fill="none"
					/>
					<circle
						class="dashboard-pomodoro-mini-ring-progress"
						cx="14"
						cy="14"
						r={radius}
						stroke-width="2.5"
						fill="none"
						stroke-linecap="round"
						stroke-dasharray={circumference}
						stroke-dashoffset={circumference * (1 - progress)}
						transform="rotate(-90 14 14)"
					/>
				</svg>
				<div class="dashboard-pomodoro-mini-tomato">🍅</div>
			</div>
			<div class="dashboard-pomodoro-mini-info" style={{ minWidth: '8ch' }}>
				<div class="dashboard-pomodoro-mini-time">
					{String(Math.floor(state.remainingSeconds / 60)).padStart(2, '0')}:
					{String(state.remainingSeconds % 60).padStart(2, '0')}
				</div>
				<div class="dashboard-pomodoro-mini-phase">
					{t(
						paused
							? 'pomodoro.paused'
							: state.phase === 'work'
								? 'pomodoro.work'
								: state.phase === 'short-break'
									? 'pomodoro.shortBreak'
									: 'pomodoro.longBreak',
					)}
				</div>
			</div>
			{button(
				state.status === 'running' ? 'pause' : 'play',
				state.status === 'running' ? 'pomodoro.pause' : 'pomodoro.start',
				toggle,
			)}
			{button('skip-forward', 'pomodoro.skip', () => service.skip())}
			{button('x', 'pomodoro.miniHide', hide, true)}
		</>
	);
}
