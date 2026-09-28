import type { App, HoverParent, TFile } from 'obsidian';
import { h } from 'preact';
import type { DashboardColumn, DataviewConfig } from '../../../core/dashboard/types';
import { mountDashboardPanel } from '../renderer/render-context';
import { DataviewPanel } from './DataviewPanel';
import { bindDataviewContext } from './context';
export function renderDataviewSection(
	el: HTMLElement,
	column: DashboardColumn,
	app: App,
	hoverParent: HoverParent | null,
	onOpenNote: ((file: TFile, subpath?: string) => void) | null,
	reloadRegister: (reload: () => void) => void,
	onConfigChange: ((config: DataviewConfig) => void) | null = null,
): void {
	const context = { app, hoverParent, opener: onOpenNote };
	bindDataviewContext(el, context);
	const root = el.createDiv({ cls: 'dashboard-dataview-content' });
	mountDashboardPanel(
		root,
		h(DataviewPanel, {
			context,
			config: column.dataviewConfig ?? { query: '' },
			reloadRegister,
			change: onConfigChange,
		}),
	);
}
