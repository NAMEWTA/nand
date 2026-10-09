import type { App } from 'obsidian';
import { h } from 'preact';
import type { DashboardColumn } from '../../core/board/types';
import { mountDashboardPanel } from '../renderer/render-context';
import { WereadPanel } from './WereadPanel';
export function renderWereadSection(
	el: HTMLElement,
	column: DashboardColumn,
	app: App,
	apiKey: string,
	importPath: string,
	onReloadReady?: (reload: () => void) => void,
): void {
	const root = el.createDiv({ cls: 'dashboard-weread-widgets' });
	mountDashboardPanel(root, h(WereadPanel, { app, apiKey, importPath, config: column.wereadConfig, onReloadReady }));
}
