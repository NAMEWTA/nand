import { Modal, Notice, Setting, type App } from 'obsidian';
import { t } from '../shared/i18n';
import type { NotificationService } from './service';

export class NotificationInbox extends Modal {
	private unsubscribe?: () => void;
	constructor(
		app: App,
		private service: NotificationService,
	) {
		super(app);
	}
	onOpen(): void {
		this.unsubscribe = this.service.subscribe(() => this.draw());
		this.draw();
	}
	onClose(): void {
		this.unsubscribe?.();
		this.contentEl.empty();
	}
	private draw(): void {
		this.contentEl.empty();
		new Setting(this.contentEl).setName(t('automation.inbox')).setHeading();
		for (const record of [...this.service.records].reverse()) {
			new Setting(this.contentEl)
				.setName(`${record.read ? '' : '● '}${record.title}`)
				.setDesc(
					`${record.body}\n${new Date(record.createdAt).toLocaleString()}\n${record.channels.map((channel) => `${t(`automation.${channel}`)}: ${t(`automation.delivery.${record.deliveries[channel] ?? 'pending'}`)}`).join(' · ')}`,
				)
				.addButton((button) =>
					button.setButtonText(t('automation.open')).onClick(() => {
						void this.service.open(record).catch((error) => new Notice(String(error)));
					}),
				)
				.addButton((button) =>
					button
						.setButtonText(t('automation.read'))
						.setDisabled(record.read)
						.onClick(() => {
							void this.service.markRead(record.id).catch((error) => new Notice(String(error)));
						}),
				);
		}
	}
}
