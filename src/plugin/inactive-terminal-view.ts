import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { onLeafLanguageChanged } from '../platform/obsidian/workspace-title';
import { t } from '../shared/i18n/index';
import { renderEmptyState } from '../view/primitives/empty-state';
import type DashboardPlugin from './main';
import { TERMINAL_VIEW_TYPE } from '../view/terminal/view-type';

/** Shown in an existing terminal leaf while the agent module is off. */
export class InactiveTerminalView extends ItemView {
	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: DashboardPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return TERMINAL_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t('modules.terminalOffTitle');
	}

	getIcon(): string {
		return 'terminal';
	}

	async onOpen(): Promise<void> {
		this.register(onLeafLanguageChanged(this.app, this.leaf, () => this.draw()));
		this.draw();
	}

	private draw(): void {
		this.contentEl.empty();
		renderEmptyState(this.contentEl, {
			icon: 'terminal',
			title: t('modules.terminal'),
			description: t('modules.terminalOff'),
			action: { label: t('modules.openHome'), run: () => this.plugin.openSettings() },
		});
	}
}
