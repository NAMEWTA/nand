import type { App, HoverParent } from 'obsidian';
import { type ContentFile } from '../../../../host/obsidian/storage/content-files';
import { createElement as h } from 'react';
import type { DashboardColumn } from '../../core/board/types';
import type { MediaTagService } from '../../platform/media/media-tags';
import { mountRecordPanel } from '../dialogs/mount-record-panel';
import { destroyDashboardPanels } from '../renderer/render-context';
import { MediaPanel } from './MediaPanel';
import { extsFor } from './media-model';
export function destroyMediaSection(sectionEl: HTMLElement): void {
	destroyDashboardPanels(sectionEl);
}
export function renderMediaSection(
	el: HTMLElement,
	column: DashboardColumn,
	app: App,
	_hoverParent: HoverParent | null,
	onOpenNote?: (file: ContentFile) => void,
	tagService?: MediaTagService,
): void {
	if (!extsFor(column.sectionType ?? '')) return;
	const root = el.createDiv({ cls: 'dashboard-library-content dashboard-media-content' });
	mountRecordPanel(root, h(MediaPanel, { app, column, openNote: onOpenNote, tagService }));
}
