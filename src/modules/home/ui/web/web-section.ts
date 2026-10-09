import { h } from 'preact';
import type { DashboardColumn } from '../../core/board/types/index';
import { mountDashboardPanel } from '../renderer/render-context';
import { WebPanel, type WebRenderOptions } from './WebPanel';
export function renderWebSection(
	el: HTMLElement,
	column: DashboardColumn,
	reloadRegister: (fn: () => void) => void,
	options?: WebRenderOptions,
): void {
	const content = el.createDiv({ cls: 'dashboard-web-content' });
	mountDashboardPanel(content, h(WebPanel, { root: el, column, reloadRegister, options }));
}
