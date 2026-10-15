import { ReactSurface } from '../../../ui/react/surface';
import { t, onLanguageChanged } from '../../../shared/i18n';
import type { NotificationService } from '../core/service';
import { type NativeSurfaceContext } from '../../../ui/native-surface';
import { InboxPanel } from './InboxPanel';

/** Inbox page: `section` `unread` shows unread records only, anything else shows all. */
export class NotificationPresentation extends ReactSurface {
	private generation = 0;
	private openable = new Set<string>();
	constructor(
		context: NativeSurfaceContext,
		private readonly service: NotificationService,
		private readonly report: (error: unknown) => void,
		private filter: 'all' | 'unread' = 'all',
	) {
		super(context);
	}
	getViewType(): string {
		return 'nand-notification-surface';
	}
	getDisplayText(): string {
		return t('workbench.notifications');
	}
	getIcon(): string {
		return 'bell';
	}
	onOpen(): Promise<void> {
		void super.onOpen();
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
		const generation = ++this.generation;
		const records = this.service.records;
		void Promise.all(records.map(async (record) => ((await this.service.canOpen(record)) ? record.id : undefined)))
			.then((ids) => {
				if (generation !== this.generation) return;
				this.openable = new Set(ids.filter((id): id is string => id !== undefined));
				this.rerender();
			})
			.catch(this.report);
		this.rerender();
	}
	protected renderContent() {
		return (
			<InboxPanel
				records={this.service.records}
				filter={this.filter}
				markRead={(id) => {
					void this.service.markRead(id).catch(this.report);
				}}
				clearRead={() => {
					void this.service.clearRead().catch(this.report);
				}}
				open={(record) => {
					void this.service.open(record).catch(this.report);
				}}
				openable={this.openable}
			/>
		);
	}
	onClose(): Promise<void> {
		this.generation++;
		return super.onClose();
	}
}
