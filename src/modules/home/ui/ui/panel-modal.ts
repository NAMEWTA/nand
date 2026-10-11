import { App, Modal } from 'obsidian';
import { render, type ComponentChild } from 'preact';
import { applyModalTheme, removeNativeModalCloseButton } from '../appearance/modal-theme';
import { closeDashboardDialogs, closeDashboardDialogsIn, closeOwnedDashboardDialogs } from './dialog-scope';
import { onLanguageChanged } from '../../../../shared/i18n';
const openPanels = new WeakMap<App, Set<DashboardPanelModal>>();
/** Native Modal owns focus, Escape and stacking. Composition closes its panels when disabling/unloading. */
export class DashboardPanelModal extends Modal {
	private languageCleanup?: () => void;
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
		if (this.className.split(' ').includes('dashboard-habit-stats-modal')) {
			this.modalEl.addClass('dashboard-habit-stats-host');
			removeNativeModalCloseButton(this.modalEl);
		}
		this.contentEl.addClass(...this.className.split(' '));
		applyModalTheme(this.contentEl);
		const paint = () => render(
			this.panel(() => this.close(), this.contentEl),
			this.contentEl,
		);
		paint();
		this.languageCleanup = onLanguageChanged(paint);
	}
	onClose(): void {
		this.languageCleanup?.();
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

export function closeOwnedDashboardPanels(app: App, owner: unknown, root?: HTMLElement): void {
	closeOwnedDashboardDialogs(app, owner);
	if (root) closeDashboardDialogsIn(app, root);
	for (const modal of [...(openPanels.get(app) ?? [])]) if (modal.owner === owner) modal.close();
}
