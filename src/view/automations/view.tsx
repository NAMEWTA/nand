import { ItemView, Modal, Notice, Setting, type WorkspaceLeaf } from 'obsidian';
import { render } from 'preact/compat';
import { onLeafLanguageChanged } from '../../platform/obsidian/workspace-title';
import { type AutomationDefinition } from '../../shared/automation/types';
import { t } from '../../shared/i18n/index';
import { AutomationsPanel } from './AutomationsPanel';
import type { AutomationPanelState, AutomationViewHost } from './panel-contract';

export const AUTOMATION_VIEW_TYPE = 'nand-automation-view';

export class AutomationView extends ItemView {
	private unsubscribe?: () => void;
	private panelState: AutomationPanelState = { selected: '', search: '', filter: '', agentFilter: '' };
	constructor(
		leaf: WorkspaceLeaf,
		private host: AutomationViewHost,
	) {
		super(leaf);
	}
	getViewType(): string {
		return AUTOMATION_VIEW_TYPE;
	}
	getDisplayText(): string {
		return t('automation.title');
	}
	getIcon(): string {
		return 'timer';
	}
	onOpen(): Promise<void> {
		this.contentEl.addClass('nand-automation-view');
		this.unsubscribe = this.host.service.subscribe(() => this.draw());
		this.register(onLeafLanguageChanged(this.app, this.leaf, () => this.draw()));
		this.register(
			this.contentEl.onWindowMigrated(() => {
				render(null, this.contentEl);
				this.draw();
			}),
		);
		this.draw();
		return Promise.resolve();
	}
	onClose(): Promise<void> {
		this.unsubscribe?.();
		render(null, this.contentEl);
		return Promise.resolve();
	}
	private clearHistory(): void {
		const modal = new Modal(this.app);
		modal.contentEl.createEl('p', { text: t('automation.clearHistoryConfirm') });
		new Setting(modal.contentEl)
			.addButton((b) => b.setButtonText(t('automation.cancel')).onClick(() => modal.close()))
			.addButton((b) =>
				b
					.setButtonText(t('automation.clearHistory'))
					.setClass('mod-warning')
					.onClick(() => {
						modal.close();
						this.run(() => this.host.service.clearHistory());
					}),
			);
		modal.open();
	}
	private remove(definition: AutomationDefinition): void {
		const modal = new Modal(this.app);
		modal.contentEl.createEl('p', { text: t('automation.deleteConfirm') });
		new Setting(modal.contentEl)
			.addButton((b) => b.setButtonText(t('automation.cancel')).onClick(() => modal.close()))
			.addButton((b) =>
				b.setButtonText(t('automation.delete')).setClass('mod-warning').onClick(() => {
					modal.close();
					this.run(() => this.host.service.remove(definition));
				}),
			);
		modal.open();
	}
	showRun(id: string): void {
		this.panelState.selected = this.host.service.state.runs.find((r) => r.id === id)?.automationId ?? '';
		this.draw();
	}
	private run(operation: () => Promise<unknown>): void {
		void operation().catch((error) => new Notice(error instanceof Error ? error.message : String(error)));
	}
	private draw(): void {
		render(
			<AutomationsPanel
				host={this.host}
				state={this.panelState}
				refresh={() => this.draw()}
				actions={{
					clearHistory: () => this.clearHistory(),
					remove: (definition) => this.remove(definition),
					run: (operation) => this.run(operation),
				}}
			/>,
			this.contentEl,
		);
	}
}
