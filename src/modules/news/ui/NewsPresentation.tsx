import { NativeSurface, type NativeSurfaceContext } from '../../../ui/native-surface';
import { render } from 'preact';
import { Component, MarkdownRenderer, type ViewStateResult } from 'obsidian';
import type { NewsService } from '../services/news-service';
import type { NewsActions } from '../services/news-actions';
import { NewsPage } from './NewsPage';
import { t } from '../../../shared/i18n';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import { newsPageState, newsTarget, type NewsPageState } from './page-state';
export class NewsPresentation extends NativeSurface {
	private state = newsPageState();
	constructor(context: NativeSurfaceContext, private readonly service: NewsService, private readonly actions: NewsActions) { super(context); }
	getViewType(): string { return 'nand-news-view'; }
	getDisplayText(): string { return t(`news.section.${this.state.section}`); }
	getIcon(): string { return 'newspaper'; }
	getState(): Record<string, unknown> { return { ...structuredClone(this.state) }; }
	getTarget(): WorkbenchTarget { return newsTarget(this.state); }
	async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> { this.state = newsPageState(state); this.paint(); await super.setState(state, result); }
	navigate(target: WorkbenchTarget): void {
		const section = newsPageState({ section: target.section ?? (target.resourceId ? 'all' : this.state.section) }).section;
		const patch: Partial<NewsPageState> = { section };
		if (section !== this.state.section) { patch.selected = ''; patch.filter = {}; }
		if (section === 'views') {
			const view = this.service.views().find(item => item.id === (target.resourceId ?? this.state.view));
			patch.view = view?.id ?? '';
			if (view && (this.state.section !== 'views' || view.id !== this.state.view)) { patch.filter = view; patch.selected = ''; }
		} else if (target.resourceId) patch.selected = target.resourceId;
		if (target.focusId?.startsWith('category:')) patch.filter = { category: target.focusId.slice(9) };
		if (target.focusId?.startsWith('source:')) patch.filter = { sourceIds: [target.focusId.slice(7)] };
		this.update(patch);
	}
	private update(patch: Partial<NewsPageState>): void { this.state = newsPageState({ ...this.state, ...patch }); this.paint(); this.context.changed?.(); }
	private readonly mountMarkdown = (host: HTMLElement, text: string, path: string): (() => void) => {
		const child = this.addChild(new Component()), output = host.createDiv();
		let disposed = false;
		void MarkdownRenderer.render(this.app, text, output, path, child).then(() => { if (disposed) child.unload(); })
			.catch(() => { if (!disposed) output.setText(text); });
		return () => { disposed = true; this.removeChild(child); output.remove(); };
	};
	onOpen(): Promise<void> { this.paint(); return Promise.resolve(); }
	setVisible(visible: boolean): void {
		super.setVisible(visible);
		if (visible) void this.service.refreshFromPolicy('visible').catch(() => undefined);
	}
	private paint(): void { render(<NewsPage service={this.service} actions={this.actions} state={this.state} onState={patch => this.update(patch)} mountMarkdown={this.mountMarkdown} />, this.contentEl); }
	onClose(): Promise<void> { render(null, this.contentEl); return Promise.resolve(); }
}
