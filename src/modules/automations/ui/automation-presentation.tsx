import { AutomationRunsPanel, type RunHistoryState } from './AutomationRunsPanel';
import type { ViewStateResult } from 'obsidian';
import { NativeSurface, type NativeSurfaceContext } from '../../../ui/native-surface';
import { Modal, Notice, Setting, } from 'obsidian';
import { render } from 'preact/compat';
import { onLeafLanguageChanged } from '../../../host/obsidian/workspace-title';
import { type AutomationDefinition } from '../../../shared/automation/types';
import { t } from '../../../shared/i18n/index';
import { AutomationsPanel } from './AutomationsPanel';
import { AutomationEditorForm, type AutomationEditRequest } from './editor';
import type { AutomationPanelState, AutomationViewHost } from './panel-contract';

export const AUTOMATION_PAGE_TYPE = 'nand-automation-view';

export class AutomationPresentation extends NativeSurface {
	private unsubscribe?: () => void;
	private section: 'tasks' | 'runs' = 'tasks';
	private runState: RunHistoryState = { search: '', status: '', offset: 0, selected: '' };
	private focusId?: string;
	private panelState: AutomationPanelState = { selected: '', search: '', filter: '', agentFilter: '' };
	private listEl!: HTMLElement;
	private editorEl!: HTMLElement;
	private editor?: AutomationEditorForm;
	constructor(
		context: NativeSurfaceContext,
		private host: AutomationViewHost,
	) {
		super(context);
	}
	getViewType(): string {
		return AUTOMATION_PAGE_TYPE;
	}
	getDisplayText(): string {
		return t('automation.title');
	}
	getIcon(): string {
		return 'timer';
	}
	onOpen(): Promise<void> {
		this.contentEl.addClass('nand-automation-page');
		this.listEl = this.contentEl.createDiv({ cls: 'nand-automation-view' });
		this.editorEl = this.contentEl.createDiv({ cls: 'nand-automation-editor-page' });
		this.editorEl.hide();
		this.unsubscribe = this.host.service.subscribe(() => this.draw());
		this.register(onLeafLanguageChanged(this.app, this.leaf, () => this.draw()));
		this.register(
			this.contentEl.onWindowMigrated(() => {
				render(null, this.listEl);
				this.draw();
			}),
		);
		this.draw();
		return Promise.resolve();
	}
	onClose(): Promise<void> {
		this.unsubscribe?.();
		this.editor?.close();
		render(null, this.listEl);
		return Promise.resolve();
	}
	/** Show the inline editor in place of the list. */
	startEdit(request: AutomationEditRequest): void {
		this.editor?.close();
		this.listEl.hide();
		this.editorEl.show();
		this.editor = new AutomationEditorForm(this.app, this.editorEl, this.host.service, () => this.host.taskTargets?.() ?? Promise.resolve([]), this.host.cwd ?? '', request, (saved) => this.stopEdit(saved), this.host.pin);
		this.editor.open();
		this.editorEl.querySelector<HTMLInputElement>('input')?.focus();
		if (this.section !== 'tasks') {
			this.section = 'tasks';
			this.context.changed?.();
		}
	}
	private stopEdit(saved?: AutomationDefinition): void {
		this.editor?.close();
		this.editor = undefined;
		this.editorEl.hide();
		this.listEl.show();
		if (saved) {
			this.panelState.selected = saved.id;
			this.section = 'tasks';
		}
		this.changed();
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
	getState(): Record<string, unknown> { return { ...this.panelState, section: this.section, runHistory: { ...this.runState } }; }
	setState(raw: Record<string, unknown>, result: ViewStateResult): Promise<void> {
		const text = (value: unknown) => typeof value === 'string' ? value.slice(0, 2048) : '';
		this.panelState = { selected: text(raw.selected), search: text(raw.search), filter: text(raw.filter), agentFilter: text(raw.agentFilter) };
		this.section = raw.section === 'runs' ? 'runs' : 'tasks';
		const history = raw.runHistory && typeof raw.runHistory === 'object' ? raw.runHistory as Record<string, unknown> : {};
		this.runState = { search: text(history.search), status: text(history.status), selected: text(history.selected), offset: typeof history.offset === 'number' && Number.isFinite(history.offset) ? Math.max(0, Math.floor(history.offset / 50) * 50) : 0 };
		this.draw(); return super.setState(raw, result);
	}
	getTarget(): { feature: 'automations'; section: string; resourceId?: string } {
		return { feature: 'automations', section: this.section, resourceId: this.section === 'runs' && this.runState.selected ? this.runState.selected : undefined };
	}
	showSection(section?: string): void { if (this.editor) this.stopEdit(); this.section = section === 'runs' ? 'runs' : 'tasks'; this.changed(); }
	showRun(id: string): void {
		const run = this.host.service.state.runs.find((item) => item.id === id);
		if (!run) throw new Error(t('workbench.missing'));
		this.panelState.selected = run.automationId;
		this.section = 'runs';
		const index = [...this.host.service.state.runs].reverse().findIndex((item) => item.id === id);
		this.runState = { search: '', status: '', selected: id, offset: Math.floor(index / 50) * 50 };
		this.focusId = id; this.changed();
	}
	setVisible(visible: boolean): void { super.setVisible(visible); if (visible) this.focusRun(); }
	private changed(): void { this.draw(); this.context.changed?.(); this.app.workspace.requestSaveLayout(); }
	private focusRun(): void {
		if (!this.focusId || this.contentEl.hidden) return;
		const row = Array.from(this.contentEl.querySelectorAll<HTMLElement>('[data-nand-run-id]')).find((element) => element.dataset.nandRunId === this.focusId);
		if (row) { row.scrollIntoView({ block: 'nearest' }); row.focus({ preventScroll: true }); this.focusId = undefined; }
	}

	private run(operation: () => Promise<unknown>): void {
		void operation().catch((error) => new Notice(error instanceof Error ? error.message : String(error)));
	}
	private draw(): void {
		render(
			this.section === 'runs' && !this.host.service.loadError ? <AutomationRunsPanel host={this.host} state={this.runState} changed={() => this.changed()} actions={{ clearHistory: () => this.clearHistory(), remove: (definition) => this.remove(definition), run: (operation) => this.run(operation) }} /> : <AutomationsPanel
				host={this.host}
				state={this.panelState}
				refresh={() => this.changed()}
				actions={{
					clearHistory: () => this.clearHistory(),
					remove: (definition) => this.remove(definition),
					run: (operation) => this.run(operation),
				}}
			/>,
			this.listEl,
		);
	}
}
