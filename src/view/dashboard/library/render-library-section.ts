import type { App, HoverParent, TFile } from 'obsidian';
import { h } from 'preact';
import type { LibraryConfig } from '../../../core/dashboard/types/index';
import { getRenderContext, mountDashboardPanel } from '../renderer/render-context';
import { LibraryPanel, type LibraryColumn } from './LibraryPanel';
export function renderLibrarySection(
	el: HTMLElement,
	column: LibraryColumn,
	app: App,
	onConfigChange: (config: LibraryConfig) => void,
	hoverParent: HoverParent | null = null,
	onOpenNote: ((file: TFile) => void) | null = null,
): void {
	const context = getRenderContext(el);
	context.hoverParent = hoverParent;
	context.noteOpener = onOpenNote;
	const root = el.createDiv({ cls: 'dashboard-library-content' });
	mountDashboardPanel(root, h(LibraryPanel, { column, app, root, context, onConfigChange }));
}
