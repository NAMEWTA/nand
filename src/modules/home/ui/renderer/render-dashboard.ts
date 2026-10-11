import { setLocalizedText } from '../../../../ui/primitives/localized-dom';
import type { HoverParent } from 'obsidian';
import { App, Component, Platform } from 'obsidian';
import { h } from 'preact';
import { effectiveBoardLayout } from '../../core/board/layout';
import { LayoutPicker } from '../LayoutPicker';
import { Button } from '../../../../ui/primitives/Button';
import { t } from '../../../../shared/i18n';
import type { DashboardColumn, DashboardData, DashboardSettings } from '../../core/board/types/index';
import { isUnderExcludedFolder, normalizeExcludeFolders } from '../../../../shared/exclude-folders';
import { renderQuickNoteRegion } from '../notes/quick-note-section';
import type { RenderCallbacks } from '../render-contract';
import { captureScrollStates, restoreScrollStates } from '../ui/scroll-preserve';
import { renderImmersiveBoard, type ImmersiveEnvironment } from './render-immersive';
import { renderSection } from './refresh-media-sections';
import { getRenderContext, mountDashboardPanel, unmountDashboardPanelsIn } from './render-context';
import { getSectionType } from './render-text-with-links';

export function renderDashboard(
	container: HTMLElement,
	data: DashboardData,
	callbacks: RenderCallbacks,
	app: App,
	settings?: DashboardSettings,
	hoverParent: HoverParent | null = null,
	opts?: { skipQuickNotes?: boolean; immersive?: ImmersiveEnvironment },
): void {
	getRenderContext(container).hoverParent = hoverParent;
	getRenderContext(container).noteOpener = callbacks.onOpenNoteInPopover ?? null;
	// The dashboard view doubles as the markdown Component (ItemView extends
	// Component); other hover-parent callers fall back to plain memo lines.
	getRenderContext(container).markdownComponent = hoverParent instanceof Component ? hoverParent : null;

	container.empty();
	container.addClass('dashboard-kanban');
	const selectedLayout = effectiveBoardLayout(data.layout, settings?.layoutMode);
	const layout = effectiveBoardLayout(data.layout, settings?.layoutMode, Platform.isPhone);
	mountDashboardPanel(container.createDiv({ cls: 'nand-board-layout-host' }), h('div', { class: 'nand-board-controls' }, h(LayoutPicker, {
		value: selectedLayout,
		choose: next => callbacks.onBoardLayout?.(next),
	}), h(Button, { onClick: () => callbacks.onBoardWidgets?.(), children: t('home.widget.manage') })));

	// Quick Notes region: pinned at the top, above all sections (non-reorderable).
	// Stacked layout hoists it out of the kanban entirely — the view renders it
	// above the widget strip instead (skipQuickNotes), because the kanban sits
	// below the strip there and the bar must stay directly under the banner.
	if (settings?.quickNotesEnabled && !opts?.skipQuickNotes) {
		renderQuickNoteRegion(container, settings, callbacks);
	}

	if (layout === 'immersive' && settings && opts?.immersive) {
		renderImmersiveBoard(container, data, callbacks, app, settings, opts.immersive);
		return;
	}

	for (const column of data.columns) {
		const section = renderSection(column, callbacks, app, data, settings, getRenderContext(container));
		container.appendChild(section);
	}

	const addColBtn = container.createEl('button', { cls: 'dashboard-add-section', attr: { type: 'button' } });
	setLocalizedText(addColBtn, 'renderer.addSection');
	addColBtn.addEventListener('click', () => {
		callbacks.onRequestAddSection();
	});
}
const SCANNING_SECTION_TYPES = new Set(['library', 'folder']);
export function invalidateScanningSectionSignatures(root: HTMLElement): void {
	getRenderContext(root).scanningSignatures.clear();
}
function scanningSectionSignature(column: DashboardColumn, app: App): string {
	const cfg = column.libraryConfig;
	const folders = (cfg?.folders ?? []).map((f) => f.trim().replace(/^\/+|\/+$/g, '')).filter((f) => f.length > 0);
	const excluded = normalizeExcludeFolders(cfg?.excludeFolders ?? []);
	const parts: string[] = [];
	for (const file of app.vault.getMarkdownFiles()) {
		if (folders.length > 0) {
			const lp = file.path.toLowerCase();
			if (!folders.some((f) => lp.startsWith(f.toLowerCase() + '/'))) continue;
		}
		if (isUnderExcludedFolder(file.path, excluded)) continue;
		parts.push(`${file.path}|${file.stat.mtime}|${file.stat.ctime}`);
	}
	// Vault iteration order is not contractual; sort for a stable signature.
	parts.sort();
	return JSON.stringify([column.name, cfg ?? null, parts]);
}
export function refreshScanningSections(
	kanban: HTMLElement,
	data: DashboardData,
	callbacks: RenderCallbacks,
	app: App,
	settings: DashboardSettings | undefined,
	hoverParent: HoverParent | null,
	shouldRefresh?: (column: DashboardColumn) => boolean,
	signatureScope?: string,
): number {
	getRenderContext(kanban).hoverParent = hoverParent;
	let refreshed = 0;
	for (const column of data.columns) {
		if (!SCANNING_SECTION_TYPES.has(getSectionType(column))) continue;
		if (shouldRefresh && !shouldRefresh(column)) continue;
		const oldEl = kanban.querySelector(`:scope > [data-column="${CSS.escape(column.name)}"]`);
		if (!oldEl) continue;
		// Skip the swap when the section's render inputs are unchanged since the
		// last one (out-of-scope edit, write inside an excluded folder, non-md
		// churn under a scan folder): rebuilding would flash identical content.
		const key = `${signatureScope ?? ''}|${data.columns.indexOf(column)}:${column.name}`;
		const signature = scanningSectionSignature(column, app);
		if (getRenderContext(kanban).scanningSignatures.get(key) === signature) continue;
		getRenderContext(kanban).scanningSignatures.set(key, signature);
		const panel = oldEl.querySelector('.dashboard-library-content');
		if (panel) {
			// The mounted Preact panel refreshes rows without losing its open
			// column editor, keyboard focus, search or pagination state.
			panel.dispatchEvent(new CustomEvent('dashboard-library-refresh'));
			continue;
		}
		const newEl = renderSection(column, callbacks, app, data, settings, getRenderContext(kanban));
		// Carry the old row's scroll positions over the swap (file lists,
		// library kanban) so a vault-event refresh doesn't yank the viewport.
		const scrollStates = captureScrollStates(oldEl);
		unmountDashboardPanelsIn(oldEl as HTMLElement);
		oldEl.replaceWith(newEl);
		restoreScrollStates(newEl, scrollStates);
		refreshed++;
	}
	return refreshed;
}
