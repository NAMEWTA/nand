import { Modal, Notice, type App } from 'obsidian';
import { h, render } from 'preact';
import type { NotificationService } from '../../core/notifications/service';
import { onLanguageChanged } from '../../shared/i18n/index';
import { InboxPanel } from './InboxPanel';

export class NotificationInbox extends Modal {
	private unsubscribe?: () => void;
	private languageCleanup?: () => void;
	constructor(
		app: App,
		private service: NotificationService,
	) {
		super(app);
	}
	onOpen(): void {
		this.languageCleanup = onLanguageChanged(() => this.draw());
		this.unsubscribe = this.service.subscribe(() => this.draw());
		this.draw();
	}
	onClose(): void {
		this.unsubscribe?.();
		this.languageCleanup?.();
		render(null, this.contentEl);
	}
	private draw(): void {
		const report = (operation: Promise<unknown>) => {
			void operation.catch((error) => {
				new Notice(error instanceof Error ? error.message : String(error));
			});
		};
		render(
			h(InboxPanel, {
				records: this.service.records,
				unread: this.service.unread,
				markRead: (id) => report(this.service.markRead(id)),
				clearRead: () => report(this.service.clearRead()),
				open: (record) => {
					// Release native modal focus before revealing the source or another modal.
					this.close();
					report(
						this.service.open(record).catch((error) => {
							this.open();
							throw error;
						}),
					);
				},
			}),
			this.contentEl,
		);
	}
}
