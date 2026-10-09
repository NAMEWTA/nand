import type { App } from 'obsidian';
import { h } from 'preact';
import type { WidgetBackground } from '../../core/board/types';
import { mountDashboardPanel } from '../renderer/render-context';
import { applyWidgetBackground, WidgetBackgroundModal } from '../widgets/widget-background';
import { MusicPanel } from './MusicPanel';
import { homeServices } from '../../services/instances';
export function renderSidebarMusicWidget(
	container: HTMLElement,
	bg?: WidgetBackground,
	app?: App,
	onBgChange?: (bg: WidgetBackground | undefined) => void,
): void {
	const service = app ? (homeServices.music ?? null) : null;
	if (!service) return;
	const root = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-music' });
	root.addEventListener('dragstart', (e) => {
		if ((e.target as HTMLElement).closest('input')) e.preventDefault();
	});
	mountDashboardPanel(
		root,
		h(MusicPanel, {
			service,
			root,
			background: app && onBgChange ? () => new WidgetBackgroundModal(app, bg, onBgChange).open() : undefined,
		}),
	);
	if (app) applyWidgetBackground(root, bg, app);
}
