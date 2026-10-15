import type { App, HoverParent } from 'obsidian';
import type { ContentFile } from '../../../../host/obsidian/storage/content-files';
import { createElement as h } from 'react';
import type { DashboardColumn, DataviewConfig } from '../../core/board/types';
import { mountRecordPanel } from '../dialogs/mount-record-panel';
import { DataviewPanel } from './DataviewPanel';
import { bindDataviewContext } from './context';
export function renderDataviewSection(
	el: HTMLElement,
	column: DashboardColumn,
	app: App,
	hoverParent: HoverParent | null,
	onOpenNote: ((file: ContentFile, subpath?: string) => void) | null,
	reloadRegister: (reload: () => void) => void,
	onConfigChange: ((config: DataviewConfig) => void) | null = null,
): void {
	const context = { app, hoverParent, opener: onOpenNote };
	bindDataviewContext(el, context);
	const root = el.createDiv({ cls: 'dashboard-dataview-content' });
	mountRecordPanel(
		root,
		h(DataviewPanel, {
			context,
			config: column.dataviewConfig ?? { query: '' },
			reloadRegister,
			change: onConfigChange,
		}),
	);
}
