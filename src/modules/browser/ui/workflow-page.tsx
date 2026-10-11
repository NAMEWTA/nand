import { render } from 'preact';
import type { PageCreate } from '../../../app/contracts/workbench-host';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import { onLeafLanguageChanged } from '../../../host/obsidian/workspace-title';
import { t } from '../../../shared/i18n';
import { NativeSurface, type NativeSurfaceContext } from '../../../ui/native-surface';
import { Button } from '../../../ui/primitives/Button';
import { BrowserError } from '../core/model';
import { browserError } from '../core/text';
import type { BrowserModule } from '../services';
import type { BrowserWorkflows } from '../services/workflows';
import { WorkflowsPage } from './WorkflowsPage';

class WorkflowPresentation extends NativeSurface {
	private opened = false;
	private workflows?: BrowserWorkflows;
	private failure: unknown;
	constructor(context: NativeSurfaceContext, private readonly module: BrowserModule, readonly resourceId?: string) { super(context); }
	getViewType(): string { return 'nand-browser-workflows'; }
	getDisplayText(): string { return t('browser.workflow.title'); }
	getIcon(): string { return 'workflow'; }
	getState(): Record<string, unknown> { return {}; }
	getTarget(): WorkbenchTarget { return { feature: 'browser', section: 'workflows', resourceId: this.resourceId }; }
	onOpen(): Promise<void> {
		this.opened = true; this.contentEl.addClass('nand-browser-workspace-view');
		this.register(onLeafLanguageChanged(this.app, this.leaf, () => this.paint()));
		this.register(this.module.subscribe(() => { this.paint(); this.context.changed?.(); }));
		this.paint(); void this.initialize(); return Promise.resolve();
	}
	private async initialize(): Promise<void> {
		try { const workflows = await this.module.getWorkflows(); if (this.opened) { this.workflows = workflows; this.failure = undefined; this.context.changed?.(); } }
		catch (error) { this.failure = error; } this.paint();
	}
	private paint(): void {
		if (!this.opened) return;
		if (!this.workflows) { render(<div class="nand-browser-workspace"><p role={this.failure ? 'alert' : 'status'}>{this.failure ? browserError(this.failure) : t('browser.workspace.loading')}</p>
			{this.failure && <Button onClick={() => { this.failure = undefined; this.paint(); void this.initialize(); }}>{t('browser.workspace.retryLoad')}</Button>}</div>, this.contentEl); return; }
		render(<WorkflowsPage module={this.module} workflows={this.workflows} resourceId={this.resourceId} />, this.contentEl);
	}
	onClose(): Promise<void> { this.opened = false; render(null, this.contentEl); return Promise.resolve(); }
}
export const createWorkflowPage = (module: BrowserModule): PageCreate => async (context, target, _state, signal) => {
	if (signal.aborted) throw new BrowserError('browser_disabled'); const surface = new WorkflowPresentation(context, module, target.resourceId);
	return { surface, getTarget: () => surface.getTarget(), restore: async () => {}, navigate: async () => {} };
};
