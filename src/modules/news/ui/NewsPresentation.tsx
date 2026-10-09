import { NativeSurface, type NativeSurfaceContext } from '../../../ui/native-surface';
import { render } from 'preact';
import type { ViewStateResult } from 'obsidian';
import type { NewsService } from '../services/news-service';
import type { NewsActions } from '../services/news-actions';
import { NewsPage } from './NewsPage';
export class NewsPresentation extends NativeSurface {
	constructor(context: NativeSurfaceContext, private readonly service: NewsService, private readonly actions: NewsActions) { super(context); }
	getViewType(): string { return 'nand-news-view'; }
	getDisplayText(): string { return 'News'; }
	getIcon(): string { return 'newspaper'; }
	getState(): Record<string, unknown> { return {}; }
	async setState(_state: Record<string, unknown>, result: ViewStateResult): Promise<void> { await super.setState({}, result); }
	onOpen(): Promise<void> { render(<NewsPage service={this.service} actions={this.actions} />, this.contentEl); this.register(this.service.subscribe(() => this.paint())); return Promise.resolve(); }
	private paint(): void { render(<NewsPage service={this.service} actions={this.actions} />, this.contentEl); }
	onClose(): Promise<void> { render(null, this.contentEl); return Promise.resolve(); }
}
