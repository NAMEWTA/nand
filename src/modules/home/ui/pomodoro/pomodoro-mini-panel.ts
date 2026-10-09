import { h, render } from 'preact';
import type { PomodoroService } from '../../platform/pomodoro/pomodoro-service';
import { applyModalTheme } from '../appearance/modal-theme';
import type { DashboardHost } from '../host';
import { restoreFloatingPos, wireFloatingDrag } from '../ui/floating-panel-utils';
import { PomodoroMiniContent } from './PomodoroMiniPanel';
export interface PomodoroMiniPanel {
	refresh(): void;
	destroy(): void;
}
export function createPomodoroMiniPanel(
	plugin: DashboardHost,
	service: PomodoroService,
	doc: Document,
): PomodoroMiniPanel {
	let root: HTMLElement | null = null,
		dismissed = false,
		seenIdle = true;
	const unmount = () => {
		if (root) {
			render(null, root);
			root.remove();
			root = null;
		}
	};
	function refresh(): void {
		const state = service.getState();
		if (state.status === 'idle') seenIdle = true;
		else if (seenIdle) {
			seenIdle = false;
			dismissed = false;
		}
		if (!plugin.settings.pomodoroMiniPanelEnabled || state.status === 'idle' || dismissed) {
			unmount();
			return;
		}
		if (!root) {
			root = doc.body.createDiv({ cls: 'dashboard-pomodoro-mini' });
			applyModalTheme(root);
			wireFloatingDrag(root, doc, 'nand.dashboard.pomodoro-mini-pos', '.dashboard-pomodoro-mini-btn', plugin.app);
			restoreFloatingPos(root, doc, 'nand.dashboard.pomodoro-mini-pos', plugin.app);
		}
		root.toggleClass('dashboard-pomodoro-mini--paused', state.status === 'paused');
		root.toggleClass('dashboard-pomodoro-mini--break', state.phase !== 'work');
		render(
			h(PomodoroMiniContent, {
				service,
				root,
				hide: () => {
					dismissed = true;
					unmount();
				},
			}),
			root,
		);
	}
	const data = service.subscribe(refresh),
		tick = service.subscribeTick(refresh);
	refresh();
	return {
		refresh,
		destroy: () => {
			data();
			tick();
			unmount();
		},
	};
}
