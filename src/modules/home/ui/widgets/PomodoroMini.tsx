// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/pomodoro-mini-panel.ts
import { createPortal } from 'react-dom';
import { useStore } from 'zustand';
import { Pause, Play, SkipForward } from 'lucide-react';
import { usePortalContainer, useVisible } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import { useDashboardLayout, useDashboardTheme } from '../theme/ThemeBridge';
import { IconButton } from '../board/controls';
export function PomodoroMini({ store }: { store: BoardStore }) {
	const settings = useStore(store.state, (s) => s.settings);
	useStore(store.state, (s) => s.widgetRevision);
	const container = usePortalContainer(),
		visible = useVisible(),
		t = useT(),
		theme = useDashboardTheme(),
		layout = useDashboardLayout(),
		timer = store.widgets.pomodoro,
		state = timer?.getState();
	if (
		!container ||
		!visible ||
		!settings.pomodoroEnabled ||
		!settings.pomodoroMiniPanelEnabled ||
		!state ||
		!timer ||
		state.status === 'idle'
	)
		return null;
	const seconds = state.mode === 'stopwatch' ? state.elapsedSeconds : state.remainingSeconds;
	return createPortal(
		<aside
			aria-label={t('home.dashboard.mini')}
			className="nand-dashboard-root fixed right-6 bottom-10 z-[var(--layer-popover)] flex items-center gap-2 rounded-full border bg-popover px-3 py-1 shadow-floating"
			data-theme={theme}
			data-dashboard-layout={layout}
		>
			<span className="text-xs tabular-nums">
				{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
			</span>
			<IconButton
				label={t(state.status === 'running' ? 'home.dashboard.pause' : 'home.dashboard.focus')}
				onClick={() => (state.status === 'running' ? timer.pause() : timer.start())}
			>
				{state.status === 'running' ? <Pause /> : <Play />}
			</IconButton>
			<IconButton label={t('home.dashboard.skip')} onClick={() => timer.skip()}>
				<SkipForward />
			</IconButton>
		</aside>,
		container,
	);
}
