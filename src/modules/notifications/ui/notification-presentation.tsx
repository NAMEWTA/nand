import { render } from 'preact';
import { t, onLanguageChanged } from '../../../shared/i18n';
import type { NotificationService } from '../core/service';
import { NativeSurface, type NativeSurfaceContext } from '../../../ui/native-surface';
import { InboxPanel } from './InboxPanel';

/** Inbox page: `section` `unread` shows unread records only, anything else shows all. */
export class NotificationPresentation extends NativeSurface {
	constructor(context: NativeSurfaceContext, private readonly service: NotificationService, private readonly report: (error: unknown) => void, private filter: 'all' | 'unread' = 'all') {
		super(context);
	}
	getViewType(): string { return 'nand-notification-surface'; }
	getDisplayText(): string { return t('workbench.notifications'); }
	getIcon(): string { return 'bell'; }
	onOpen(): Promise<void> {
		this.contentEl.addClass('nand-inbox-page');
		this.register(this.service.subscribe(() => this.draw()));
		this.register(onLanguageChanged(() => this.draw()));
		this.draw();
		return Promise.resolve();
	}
	setFilter(filter: 'all' | 'unread'): void {
		if (filter === this.filter) return;
		this.filter = filter;
		this.draw();
	}
	private draw(): void {
		render(
			<InboxPanel
				records={this.service.records}
				filter={this.filter}
				markRead={(id) => { void this.service.markRead(id).catch(this.report); }}
				clearRead={() => { void this.service.clearRead().catch(this.report); }}
				open={(record) => { void this.service.open(record).catch(this.report); }}
			/>,
			this.contentEl,
		);
	}
	onClose(): Promise<void> {
		render(null, this.contentEl);
		return Promise.resolve();
	}
}
