import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { h, render as paint } from 'preact';
import type { EditorDomainId } from '../../../shared/editor-workbench';
import { t } from '../../../shared/i18n/index';
import { onLeafLanguageChanged } from '../../../platform/obsidian/workspace-title';
import { EmptyState } from '../../primitives/EmptyState';

import type { EditorHost, EditorPluginHost } from '../host';
import { detachPanel, watchActiveFile } from './lifecycle';
import { renderDomainTabs } from './tabs';

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
		private readonly plugin: EditorPluginHost,
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
		this.offLanguage = onLeafLanguageChanged(this.app, this.leaf, () => {
			const scroll = this.bodyEl?.scrollTop ?? 0;
			if (this.plugin.settings.modules.editor) {
				// Comment panels translate in place so their focus and scroll survive.
				if (this.plugin.settings.editorWorkbench.activeDomain === 'comments') this.renderTabs();
				else this.render();
			} else this.renderDisabled();
			if (this.bodyEl) this.bodyEl.scrollTop = scroll;
		});
		if (this.tabsEl) paint(null, this.tabsEl);
		paint(null, this.contentEl);
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
		if (this.tabsEl) paint(null, this.tabsEl);
		paint(null, this.contentEl);
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
		if (this.tabsEl) paint(null, this.tabsEl);
		paint(null, this.contentEl);
		this.contentEl.empty();
		this.tabsEl = null;
		this.bodyEl = null;
		paint(
			h(EmptyState, {
				icon: 'pen-line',
				title: t('modules.editor'),
				description: t('modules.editorOff'),
				action: { label: t('modules.openHome'), run: () => this.plugin.openHome() },
			}),
			this.contentEl,
		);
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
