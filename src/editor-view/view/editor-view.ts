import { renderEmptyState } from '../../shared/empty-state';
import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { EditorDomainId } from '../../shared/editor-workbench';
import { onLanguageChanged, t } from '../../shared/i18n';
import type { EditorHost } from '../host/host';
import { detachPanel, watchActiveFile } from './lifecycle';
import { renderDomainTabs } from './tabs';
import type DashboardPlugin from '../../plugin/main';

export const EDITOR_VIEW_TYPE = 'nand-editor-view';

/** Right-hand editor panel. Closing it does not unload the editor host. */
export class EditorView extends ItemView {
	private unmount: (() => void) | null = null;
	private offFile: (() => void) | null = null;
	private offLayout: (() => void) | null = null;
	private offLanguage: (() => void) | null = null;
	private tabsEl: HTMLElement | null = null;
	private bodyEl: HTMLElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: DashboardPlugin,
	) {
		super(leaf);
		this.navigation = false;
	}

	getViewType(): string {
		return EDITOR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t('editor.viewTitle');
	}

	getIcon(): string {
		return 'pen-line';
	}

	async applyModuleGate(): Promise<void> {
		this.offFile?.();
		this.offFile = null;
		this.offLayout?.();
		this.offLayout = null;
		this.unmount = detachPanel(this.unmount);
		await this.onOpen();
	}

	async onOpen(): Promise<void> {
		this.offLanguage?.();
		this.offLanguage = onLanguageChanged(() => {
			const scroll = this.bodyEl?.scrollTop ?? 0;
			if (this.plugin.settings.modules.editor) {
				// Comment panels translate in place so their focus and scroll survive.
				if (this.plugin.settings.editorWorkbench.activeDomain === 'comments') this.renderTabs();
				else this.render();
			} else this.renderDisabled();
			if (this.bodyEl) this.bodyEl.scrollTop = scroll;
			(this.leaf as WorkspaceLeaf & { updateHeader?: () => void }).updateHeader?.();
		});
		this.contentEl.empty();
		this.contentEl.addClass('nand-editor-view');
		if (!this.plugin.settings.modules.editor || !this.plugin.editorHost) {
			this.renderDisabled();
			return;
		}
		this.tabsEl = this.contentEl.createDiv({ cls: 'nand-editor-tabs-host' });
		this.bodyEl = this.contentEl.createDiv({ cls: 'nand-editor-body' });
		this.offFile = watchActiveFile(this.plugin.editorHost, () => this.render());
		this.offLayout = this.plugin.editorHost.onLayoutChanged(() => this.render());
		this.render();
	}

	async onClose(): Promise<void> {
		this.offLanguage?.();
		this.offLanguage = null;
		this.offFile?.();
		this.offFile = null;
		this.offLayout?.();
		this.offLayout = null;
		this.unmount = detachPanel(this.unmount);
	}

	private renderTabs(): void {
		if (!this.tabsEl || !this.plugin.editorHost) return;
		const buttons = Array.from(this.tabsEl.querySelectorAll('button'));
		const focused = buttons.indexOf(this.tabsEl.ownerDocument.activeElement as HTMLButtonElement);
		renderDomainTabs(
			this.tabsEl,
			this.plugin.editorHost.domains(),
			this.plugin.settings.editorWorkbench.activeDomain,
			(id) => {
				void this.activate(id);
			},
		);
		if (focused >= 0) this.tabsEl.querySelectorAll('button')[focused]?.focus();
	}

	private render(): void {
		const tabs = this.tabsEl;
		const body = this.bodyEl;
		if (!tabs || !body) return;
		const host: EditorHost | undefined = this.plugin.editorHost;
		if (!host) return;
		const domainId = this.plugin.settings.editorWorkbench.activeDomain;
		const domains = host.domains();
		this.renderTabs();
		this.unmount = detachPanel(this.unmount);
		const domain = domains.find((item) => item.id === domainId) ?? domains[0];
		if (!domain?.mountPanel) {
			body.empty();
			return;
		}
		this.unmount = domain.mountPanel(body, {
			app: this.app,
			plugin: this.plugin,
			file: host.getActiveFile(),
		});
	}

	private renderDisabled(): void {
		this.contentEl.empty();
		this.tabsEl = null;
		this.bodyEl = null;
		renderEmptyState(this.contentEl, {
			icon: 'pen-line',
			title: t('modules.editor'),
			description: t('modules.editorOff'),
			action: { label: t('modules.openHome'), run: () => this.plugin.openHome() },
		});
	}

	private async activate(id: EditorDomainId): Promise<void> {
		if (this.plugin.settings.editorWorkbench.activeDomain === id) return;
		this.plugin.settings = {
			...this.plugin.settings,
			editorWorkbench: { ...this.plugin.settings.editorWorkbench, activeDomain: id },
		};
		await this.plugin.saveSettings();
		this.render();
	}
}
