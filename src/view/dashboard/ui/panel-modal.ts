import { App, Modal } from 'obsidian';
import { render, type ComponentChild } from 'preact';
import { applyModalTheme } from '../appearance/modal-theme';
import { closeDashboardDialogs } from './dialog-scope';
const openPanels = new WeakMap<App, Set<DashboardPanelModal>>();
/** Native Modal owns focus, Escape and stacking. Composition closes its panels when disabling/unloading. */
export class DashboardPanelModal extends Modal {
	constructor(
		app: App,
		private readonly className: string,
		private readonly panel: (close: () => void, root: HTMLElement) => ComponentChild,
		readonly owner?: unknown,
	) {
		super(app);
	}
	onOpen(): void {
		let panels = openPanels.get(this.app);
		if (!panels) {
			panels = new Set();
			openPanels.set(this.app, panels);
		}
		panels.add(this);
		this.modalEl.addClass('nand-panel-modal');
		this.contentEl.addClass(...this.className.split(' '));
		applyModalTheme(this.contentEl);
		render(
			this.panel(() => this.close(), this.contentEl),
			this.contentEl,
		);
	}
	onClose(): void {
		openPanels.get(this.app)?.delete(this);
		render(null, this.contentEl);
		this.contentEl.empty();
	}
}
export function closeDashboardPanelModals(app: App): void {
	closeDashboardDialogs(app);
	for (const modal of [...(openPanels.get(app) ?? [])]) modal.close();
	openPanels.delete(app);
}

export function closeOwnedDashboardPanels(app: App, owner: unknown): void {
	for (const modal of [...(openPanels.get(app) ?? [])]) if (modal.owner === owner) modal.close();
}
