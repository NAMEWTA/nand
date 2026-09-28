import type { App } from 'obsidian';
import { h } from 'preact';
import type { AlbumConfig, DashboardSettings } from '../../../core/dashboard/types';
import { mountDashboardPanel, unmountDashboardPanelsIn } from '../renderer/render-context';
import { AlbumPanel, albumControllers } from './AlbumPanel';
import { listAlbumImages } from './album-model';
export function destroyAlbumWidgets(root: HTMLElement, preserveWidgets?: HTMLElement | null): void {
	for (const widget of Array.from(root.querySelectorAll<HTMLElement>('.dashboard-sidebar-album'))) {
		if (!preserveWidgets?.contains(widget)) unmountDashboardPanelsIn(widget);
	}
}
export function refreshAlbumWidget(root: HTMLElement, settings: DashboardSettings, app: App): boolean {
	const el = root.querySelector<HTMLElement>('.dashboard-sidebar-album');
	if (!el || !el.isConnected) return false;
	const controller = albumControllers.get(el);
	if (!controller) return false;
	controller.setImages(listAlbumImages(app, settings.widgetAlbumFolder, settings.widgetAlbumRecursive));
	return true;
}

/** Multi-album refresh: pushes a freshly scanned image list into every live
 *  album card, matched to its config via data-album-id. Absent entries (no
 *  card in the DOM yet) are skipped, not errors. */
export function refreshAlbumWidgets(root: HTMLElement, albums: AlbumConfig[], app: App): void {
	for (const cfg of albums) {
		const el = root.querySelector<HTMLElement>(`.dashboard-sidebar-album[data-album-id="${cfg.id}"]`);
		if (!el || !el.isConnected) continue;
		const controller = albumControllers.get(el);
		if (!controller) continue;
		controller.setImages(listAlbumImages(app, cfg.folder, cfg.recursive));
	}
}

export function renderSidebarAlbumWidget(container: HTMLElement, settings: DashboardSettings, app: App): void {
	const root = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-album' });
	root.addClass(
		settings.widgetAlbumRatio === '3:4'
			? 'dashboard-sidebar-album--ratio-3-4'
			: 'dashboard-sidebar-album--ratio-1-1',
	);
	mountDashboardPanel(root, h(AlbumPanel, { root, settings, app }));
}
