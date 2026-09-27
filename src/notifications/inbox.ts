import { Modal, Notice, Setting, type App } from 'obsidian';
import { getLanguage, onLanguageChanged, t } from '../shared/i18n';
import type { NotificationService } from './service';

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
		this.contentEl.empty();
	}
	private draw(): void {
		this.contentEl.empty();
		new Setting(this.contentEl).setName(`${t('automation.inbox')} (${this.service.unread})`).setHeading()
			.addButton((button) => button.setButtonText(t('automation.readAll')).onClick(() => { void this.service.markRead().catch((error) => { new Notice(String(error)); }); }))
			.addButton((button) => button.setButtonText(t('automation.clearRead')).onClick(() => { void this.service.clearRead().catch((error) => { new Notice(String(error)); }); }));
		if (!this.service.records.length) this.contentEl.createEl('p', { text: t('automation.inboxEmpty') });
		for (const record of [...this.service.records].reverse()) {
			const setting = new Setting(this.contentEl)
				.setName(`${record.read ? '' : '● '}${record.title}`)
				.setDesc(
					`${record.body}\n${new Date(record.createdAt).toLocaleString(getLanguage() === 'zh' ? 'zh-CN' : 'en-US')}\n${record.channels.map((channel) => `${t(`automation.${channel}`)}: ${t(`automation.delivery.${record.deliveries[channel] ?? 'pending'}`)}`).join(' · ')}`,
				);
			setting.descEl.addClass('nand-notification-description');
			if (record.source || record.target) setting.addButton((button) => button.setButtonText(t('automation.open')).onClick(() => {
				void this.service.open(record).then(() => { this.close(); }).catch((error) => { new Notice(String(error)); });
			}));
			if (!record.read) setting.addButton((button) => button.setButtonText(t('automation.read')).onClick(() => {
				void this.service.markRead(record.id).catch((error) => { new Notice(String(error)); });
			}));
		}
	}
}
