import type { App, HoverParent } from 'obsidian';
import { type ContentFile } from '../../../../host/obsidian/storage/content-files';
import { h } from 'preact';
import type { DashboardColumn } from '../../core/board/types';
import type { MediaTagService } from '../../platform/media/media-tags';
import { mountDashboardPanel, unmountDashboardPanelsIn } from '../renderer/render-context';
import { MediaPanel } from './MediaPanel';
import { extsFor } from './media-model';
export function destroyMediaSection(sectionEl: HTMLElement): void {
	unmountDashboardPanelsIn(sectionEl);
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
	mountDashboardPanel(root, h(MediaPanel, { app, column, openNote: onOpenNote, tagService }));
}
