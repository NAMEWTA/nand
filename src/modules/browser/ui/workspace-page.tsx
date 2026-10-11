import { Component, MarkdownRenderer, Platform } from 'obsidian';
import { render } from 'preact';
import type { PageCreate } from '../../../app/contracts/workbench-host';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import { onLeafLanguageChanged } from '../../../host/obsidian/workspace-title';
import { t } from '../../../shared/i18n';
import { NativeSurface, type NativeSurfaceContext } from '../../../ui/native-surface';
import { Button } from '../../../ui/primitives/Button';
import { BrowserError, newPageState, type BrowserPageState } from '../core/model';
import { officialConversationUrl } from '../core/providers/official-url';
import { browserError } from '../core/text';
import type { TargetBinding } from '../core/workspace/model';
import type { BrowserModule } from '../services';
import type { Workspace } from '../services/workspace';
import { browserHost } from './browser-host';
import { WorkspacePage } from './WorkspacePage';
import { WorkspaceRecovery } from './WorkspaceRecovery';

/** Owns presentation resources only. Restoring a task never creates a guest or contacts its provider. */
export class WorkspacePresentation extends NativeSurface {
	private opened = false;
	private workspace?: Workspace;
	private failure: unknown;
	private readonly host;
	private readonly panes = new Map<string, { state: BrowserPageState; unregister: () => void }>();
	constructor(context: NativeSurfaceContext, private readonly module: BrowserModule, readonly taskId?: string) {
		super(context); this.host = browserHost(module, () => this.contentEl.win);
	}
	getViewType(): string { return 'nand-browser-workspace'; }
	getDisplayText(): string { return this.workspace?.data().tasks.find(task => task.id === this.taskId)?.title ?? t('browser.workspace.title'); }
	getIcon(): string { return 'messages-square'; }
	getState(): Record<string, unknown> { return {}; }
	getTarget(): WorkbenchTarget { return { feature: 'browser', section: 'multi-ai', resourceId: this.taskId }; }
	onOpen(): Promise<void> {
		this.opened = true; this.contentEl.addClass('nand-browser-workspace-view');
		this.register(onLeafLanguageChanged(this.app, this.leaf, () => this.paint()));
		this.register(this.contentEl.onWindowMigrated(() => {
			if (this.taskId) this.workspace?.pause(this.taskId);
			this.closePanes(); render(null, this.contentEl); this.paint();
		}));
		this.paint(); void this.initialize(); return Promise.resolve();
	}
	private async initialize(): Promise<void> {
		try {
			const workspace = await this.module.getWorkspace();
			if (!this.opened) return;
			this.workspace = workspace;
			this.register(workspace.subscribe(() => { this.paint(); this.context.changed?.(); }));
			this.register(this.module.subscribe(() => this.paint()));
			this.failure = undefined;
		} catch (error) { this.failure = error; }
		this.paint();
	}
	private readonly mountMarkdown = (host: HTMLElement, text: string): (() => void) => {
		const child = this.addChild(new Component()), output = host.createDiv();
		let disposed = false;
		void MarkdownRenderer.render(this.app, text, output, this.module.settings().workspaceFolder ?? '', child)
			.then(() => { if (disposed) child.unload(); }).catch(() => { if (!disposed) output.setText(text); });
		return () => { disposed = true; this.removeChild(child); output.remove(); };
	};
	private readonly openTarget = async (binding: TargetBinding): Promise<void> => {
		if (!Platform.isDesktopApp) throw new BrowserError('browser_workspace_desktop');
		const id = binding.page?.pageId ?? binding.id;
		if (this.host.presentationExists?.(id)) { await this.host.activate(id); return; }
		if (!this.opened || !this.taskId || !this.workspace) throw new BrowserError('browser_disabled');
		const url = officialConversationUrl(binding.provider, binding.provider === 'coze' || binding.provider === 'minimax' ? undefined : binding.conversationId);
		if (!url) throw new BrowserError('browser_workspace_provider_unsupported');
		const task = this.workspace.data().tasks.find(task => task.id === this.taskId)!;
		if (!task.visibleTargetIds.includes(binding.id))
			await this.workspace.setTargetVisible(this.taskId, binding.id, true);
		if (task.panelLayout?.focused !== binding.id || task.panelLayout?.maximized)
			await this.workspace.updatePanelLayout(this.taskId, { kind: 'focus', targetId: binding.id });
		if (!this.opened) return;
		const entry = { state: newPageState(id, { profileId: binding.profileId, url }), unregister: () => {} };
		entry.unregister = this.host.registerPresentation(id, async admit => {
			admit?.(); await this.app.workspace.revealLeaf(this.leaf); admit?.(); await this.context.activate?.(); admit?.();
			const current = this.workspace!.data().tasks.find(task => task.id === this.taskId)!;
			if (!current.visibleTargetIds.includes(binding.id))
				await this.workspace!.setTargetVisible(this.taskId!, binding.id, true);
			if (current.panelLayout?.focused !== binding.id || current.panelLayout?.maximized)
				await this.workspace!.updatePanelLayout(this.taskId!, { kind: 'focus', targetId: binding.id });
			admit?.();
			this.paint();
			const pane = [...this.contentEl.querySelectorAll<HTMLElement>('.nand-browser-workspace-pane')].find(element => element.dataset.targetId === binding.id);
			pane?.scrollIntoView({ block: 'center' });
			await new Promise<void>(resolve => this.contentEl.win.requestAnimationFrame(() => resolve()));
		}, () => this.closeTarget(binding.id), () => ({ ...entry.state }));
		this.panes.set(binding.id, entry); this.paint();
	};
	private closeTarget(id: string): void {
		if (this.taskId) this.workspace?.pause(this.taskId);
		this.panes.get(id)?.unregister(); this.panes.delete(id); this.paint();
	}
	private closePanes(): void { for (const entry of this.panes.values()) entry.unregister(); this.panes.clear(); }
	private paint(): void {
		if (!this.opened) return;
		if (this.taskId && this.workspace && !this.workspace.data().tasks.some(task => task.id === this.taskId)) this.closePanes();
		const recovery = <WorkspaceRecovery module={this.module} mount={this.mountMarkdown} restored={() => { if (!this.workspace) void this.initialize(); else this.paint(); }} />;
		if (!this.workspace) {
			render(<><div class={this.failure ? 'nand-browser-workspace' : 'nand-browser-empty'}>
				<p role={this.failure ? 'alert' : 'status'}>{this.failure ? browserError(this.failure) : t('browser.workspace.loading')}</p>
				{this.failure && <Button onClick={() => { this.failure = undefined; this.paint(); void this.initialize(); }}>{t('browser.workspace.retryLoad')}</Button>}
			</div>{this.failure && recovery}</>, this.contentEl); return;
		}
		render(<><WorkspacePage workspace={this.workspace} module={this.module} host={this.host} taskId={this.taskId}
			panes={this.panes} openTarget={this.openTarget} closeTarget={id => this.closeTarget(id)}
			create={async (title, profileId, accountLabel, provider) => {
				const id = await this.module.createWorkspaceTask(title, profileId, accountLabel, provider);
				await this.module.openWorkspace(id, this.contentEl.win);
			}} mountMarkdown={this.mountMarkdown} />{recovery}</>, this.contentEl);
	}
	async onClose(): Promise<void> {
		this.opened = false;
		if (this.taskId) this.workspace?.pause(this.taskId);
		this.closePanes(); render(null, this.contentEl);
		if (this.taskId) await this.workspace?.flushDraft(this.taskId);
	}
}

export const createWorkspacePage = (module: BrowserModule): PageCreate => async (context, target, _state, signal) => {
	if (signal.aborted) throw new BrowserError('browser_disabled');
	const surface = new WorkspacePresentation(context, module, target.resourceId);
	return { surface, getTarget: () => surface.getTarget(), restore: async () => {}, navigate: async () => {} };
};
