import { h } from 'preact';
import type { App } from 'obsidian';
import type { DashboardColumn } from '../../core/board/types/index';
import { mountDashboardPanel } from '../renderer/render-context';
import { WebPanel, type WebRenderOptions } from './WebPanel';
export function renderWebSection(
	el: HTMLElement,
	app: App,
	column: DashboardColumn,
	reloadRegister: (fn: () => void) => void,
	options?: WebRenderOptions,
): void {
	const content = el.createDiv({ cls: 'dashboard-web-content' });
	mountDashboardPanel(content, h(WebPanel, { app, root: el, column, reloadRegister, options }));
}
