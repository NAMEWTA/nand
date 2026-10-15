import { createElement as h } from 'react';
import type { App } from 'obsidian';
import type { DashboardColumn } from '../../core/board/types/index';
import { mountRecordPanel } from '../dialogs/mount-record-panel';
import { WebPanel, type WebRenderOptions } from './WebPanel';
export function renderWebSection(
	el: HTMLElement,
	app: App,
	column: DashboardColumn,
	reloadRegister: (fn: () => void) => void,
	options?: WebRenderOptions,
): void {
	const content = el.createDiv({ cls: 'dashboard-web-content' });
	mountRecordPanel(content, h(WebPanel, { app, root: el, column, reloadRegister, options }));
}
