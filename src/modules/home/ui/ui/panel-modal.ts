import type { App } from 'obsidian';
import { closeDashboardDialogs, closeDashboardDialogsIn, closeOwnedDashboardDialogs } from './dialog-scope';
export function closeDashboardPanelModals(app: App): void {
	closeDashboardDialogs(app);
}
export function closeOwnedDashboardPanels(app: App, owner: unknown, root?: HTMLElement): void {
	closeOwnedDashboardDialogs(app, owner);
	if (root) closeDashboardDialogsIn(app, root);
}
