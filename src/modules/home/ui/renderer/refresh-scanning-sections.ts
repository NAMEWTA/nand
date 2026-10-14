// P1 legacy scanning adapter; the React P0 library subscribes through BoardStore.
import type { App, HoverParent } from 'obsidian';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
import { CONTENT_ROOT, contentPath } from '../../../../shared/storage/content-paths';
import { isUnderExcludedFolder, normalizeExcludeFolders } from '../../../../shared/exclude-folders';
import type { DashboardColumn, DashboardData, DashboardSettings } from '../../core/board/types';
import type { RenderCallbacks } from '../render-contract';
import { captureScrollStates, restoreScrollStates } from '../ui/scroll-preserve';
import { renderSection } from './refresh-media-sections';
import { getRenderContext, unmountDashboardPanelsIn } from './render-context';
import { getSectionType } from './render-text-with-links';
const SCANNING_SECTION_TYPES = new Set(['library', 'folder']);
export function invalidateScanningSectionSignatures(root: HTMLElement): void {
	getRenderContext(root).scanningSignatures.clear();
}
function scanningSectionSignature(column: DashboardColumn, app: App): string {
	const cfg = column.libraryConfig;
	const folders = (cfg?.folders ?? []).map((f) => f.trim().replace(/^\/+|\/+$/g, '')).filter((f) => f.length > 0).flatMap(folder => [folder, contentPath(folder)]);
	const excluded = normalizeExcludeFolders(cfg?.excludeFolders ?? []);
	const parts: string[] = [];
	for (const file of contentFiles(app).getMarkdownFiles()) {
		if (folders.length > 0) {
			const lp = file.path.toLowerCase();
			if (!folders.some((f) => lp.startsWith(f.toLowerCase() + '/'))) continue;
		}
		if ((isUnderExcludedFolder(file.path, excluded) || isUnderExcludedFolder(file.path.replace(CONTENT_ROOT + '/', ''), excluded))) continue;
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
