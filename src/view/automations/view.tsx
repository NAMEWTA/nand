import { AUTOMATION_VIEW_TYPE } from './automation-presentation';
import { t } from '../../shared/i18n';
import { ItemView, type WorkspaceLeaf, type ViewStateResult } from 'obsidian';
import { AutomationPresentation } from './automation-presentation';
import type { AutomationViewHost } from './panel-contract';
export { AUTOMATION_VIEW_TYPE } from './automation-presentation';

/** Original native identity; business presentation is shared with the workbench. */
export class AutomationView extends ItemView {
	readonly surface: AutomationPresentation;
	constructor(leaf: WorkspaceLeaf, host: AutomationViewHost) {
		super(leaf);
		this.surface = this.addChild(new AutomationPresentation({
			app: this.app, leaf, contentEl: this.contentEl, containerEl: this.contentEl,
			addAction: (icon, title, callback) => this.addAction(icon, title, callback),
			close: () => this.leaf.detach(),
		}, host));
	}
	getNativeSurfaces(): readonly AutomationPresentation[] { return this.surface ? [this.surface] : []; }
	onOpen(): Promise<void> { return this.surface.onOpen(); }
	onClose(): Promise<void> { return this.surface.onClose(); }
	getState(): Record<string, unknown> { return this.surface?.getState() ?? {}; }
	async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
		await this.surface.setState(state, result);
		await super.setState(state, result);
	}

	getViewType(): string { return AUTOMATION_VIEW_TYPE; }

	getDisplayText(): string { return this.surface?.getDisplayText() ?? t('automation.title'); }

	getIcon(): string { return 'timer'; }
	showRun(...args: Parameters<AutomationPresentation['showRun']>): ReturnType<AutomationPresentation['showRun']> { return this.surface.showRun(...args); }
}
