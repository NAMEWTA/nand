import { Component, MarkdownRenderer } from 'obsidian';
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
import type { WebAssistant as AssistantService } from '../services/assistant';
import { WebAssistant } from './WebAssistant';
import { AssistantRecovery } from './AssistantRecovery';

class AssistantPresentation extends NativeSurface {
	private opened = false;
	private assistant?: AssistantService;
	private failure: unknown;
	constructor(context: NativeSurfaceContext, private readonly module: BrowserModule, readonly taskId?: string) { super(context); }
	getViewType(): string { return 'nand-browser-assistant'; }
	getDisplayText(): string { return this.assistant?.records().find(task => task.id === this.taskId)?.title ?? t('browser.assistant.title'); }
	getIcon(): string { return 'bot'; }
	getState(): Record<string, unknown> { return {}; }
	getTarget(): WorkbenchTarget { return { feature: 'browser', section: 'assistant', resourceId: this.taskId }; }
	onOpen(): Promise<void> {
		this.opened = true; this.contentEl.addClass('nand-browser-workspace-view');
		this.register(onLeafLanguageChanged(this.app, this.leaf, () => this.paint()));
		this.register(this.module.subscribe(() => { this.paint(); this.context.changed?.(); }));
		this.register(this.contentEl.onWindowMigrated(() => { if (this.taskId) this.assistant?.stop(this.taskId, 'paused'); this.paint(); }));
		this.paint(); void this.initialize(); return Promise.resolve();
	}
	private async initialize(): Promise<void> {
		try { const assistant = await this.module.getAssistant(); if (this.opened) { this.assistant = assistant; this.failure = undefined; this.context.changed?.(); } }
		catch (error) { this.failure = error; }
		this.paint();
	}
	private readonly mountMarkdown = (host: HTMLElement, text: string): (() => void) => {
		const child = this.addChild(new Component()), output = host.createDiv(); let disposed = false;
		void MarkdownRenderer.render(this.app, text, output, this.module.settings().workspaceFolder ?? '', child)
			.then(() => { if (disposed) child.unload(); }).catch(() => { if (!disposed) output.setText(text); });
		return () => { disposed = true; this.removeChild(child); output.remove(); };
	};
	private paint(): void {
		if (!this.opened) return;
		const recovery = <AssistantRecovery module={this.module} mount={this.mountMarkdown} restored={() => { void this.initialize(); }} />;
		if (!this.assistant) { render(<><div class="nand-browser-workspace"><p role={this.failure ? 'alert' : 'status'}>{this.failure ? browserError(this.failure) : t('browser.workspace.loading')}</p>
			{this.failure && <Button onClick={() => { this.failure = undefined; this.paint(); void this.initialize(); }}>{t('browser.workspace.retryLoad')}</Button>}</div>{this.failure && recovery}</>, this.contentEl); return; }
		render(<><WebAssistant module={this.module} assistant={this.assistant} taskId={this.taskId} mount={this.mountMarkdown} />{recovery}</>, this.contentEl);
	}
	onClose(): Promise<void> { this.opened = false; render(null, this.contentEl); return Promise.resolve(); }
}
export const createAssistantPage = (module: BrowserModule): PageCreate => async (context, target, _state, signal) => {
	if (signal.aborted) throw new BrowserError('browser_disabled');
	const surface = new AssistantPresentation(context, module, target.resourceId);
	return { surface, getTarget: () => surface.getTarget(), restore: async () => {}, navigate: async () => {} };
};
