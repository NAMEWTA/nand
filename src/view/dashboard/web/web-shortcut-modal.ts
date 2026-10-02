import { bindLocalizedOptions } from '../../primitives/localized-dom';
import { bindLocalizedControl } from '../../primitives/localized-dom';
import { Modal, Notice, Setting, type App } from 'obsidian';
import { normalizeBrowserUrl } from '../../../core/browser/url';
import type { DashboardCard } from '../../../core/dashboard/types/model';
import { t } from '../../../shared/i18n';

type Shortcut = Pick<DashboardCard, 'title' | 'url' | 'openIn'>;
export class WebShortcutModal extends Modal {
	constructor(
		app: App,
		private readonly value: Partial<Shortcut>,
		private readonly save: (value: Shortcut) => Promise<unknown>,
	) {
		super(app);
	}
	onOpen(): void {
		bindLocalizedControl(this.setTitle(t('browser.shortcut')), "title", 'browser.shortcut');
		let name = this.value.title ?? '',
			url = this.value.url ?? '',
			openIn = this.value.openIn ?? 'modal';
		bindLocalizedControl(new Setting(this.contentEl).setName(t('browser.name')), "name", 'browser.name').addText((input) =>
			input.setValue(name).onChange((value) => {
				name = value;
			}),
		);
		bindLocalizedControl(new Setting(this.contentEl).setName(t('browser.url')), "name", 'browser.url').addText((input) =>
			input
				.setValue(url)
				.setPlaceholder('https://example.com')
				.onChange((value) => {
					url = value;
				}),
		);
		bindLocalizedControl(new Setting(this.contentEl).setName(t('browser.openIn')), "name", 'browser.openIn').addDropdown((dropdown) =>
			bindLocalizedOptions(dropdown
				.addOptions({ modal: t('browser.modal'), tab: t('browser.tab') }), {modal: ['browser.modal'], tab: ['browser.tab']})
				.setValue(openIn)
				.onChange((value) => {
					openIn = value === 'tab' ? 'tab' : 'modal';
				}),
		);
		new Setting(this.contentEl)
			.addButton((button) => bindLocalizedControl(button.setButtonText(t('browser.cancel')), "buttonText", 'browser.cancel').onClick(() => this.close()))
			.addButton((button) =>
				bindLocalizedControl(button
					.setCta()
					.setButtonText(t('browser.save')), "buttonText", 'browser.save')
					.onClick(async () => {
						let normalized: string;
						try {
							normalized = normalizeBrowserUrl(url);
							if (normalized === 'about:blank') throw new Error();
						} catch {
							new Notice(t('browser.browser_invalid_url'));
							return;
						}
						try {
							button.setDisabled(true);
							await this.save({
								title: name.trim().replace(/[\r\n]/g, ' ') || new URL(normalized).hostname,
								url: normalized,
								openIn,
							});
							this.close();
						} catch {
							button.setDisabled(false);
							new Notice(t('browser.saveFailed'));
						}
					}),
			);
	}
	onClose(): void {
		this.contentEl.empty();
	}
}
