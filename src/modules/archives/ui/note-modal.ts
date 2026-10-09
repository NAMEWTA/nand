import { bindLocalizedControl } from '../../../ui/primitives/localized-dom';
import { Modal, Setting, type App } from 'obsidian';
import { ct, errorText } from './forms';

export class ArchiveNoteModal extends Modal {
	constructor(
		app: App,
		private create: (name: string) => Promise<void>,
	) {
		super(app);
	}
	onOpen(): void {
		bindLocalizedControl(this.setTitle(ct('newNote')), "title", "contacts." + ('newNote'));
		let name = '',
			busy = false;
		const error = this.contentEl.createDiv({ cls: 'nand-contacts-error', attr: { role: 'alert' } });
		let field: HTMLInputElement;
		bindLocalizedControl(new Setting(this.contentEl).setName(ct('fileName')), "name", "contacts." + ('fileName')).addText((input) => {
			field = input.inputEl;
			input.onChange((value) => {
				name = value;
			});
			input.inputEl.focus();
		});
		new Setting(this.contentEl)
			.addButton((button) =>
				bindLocalizedControl(button.setButtonText(ct('cancel')), "buttonText", "contacts." + ('cancel')).onClick(() => {
					if (!busy) this.close();
				}),
			)
			.addButton((button) =>
				bindLocalizedControl(button
					.setButtonText(ct('save')), "buttonText", "contacts." + ('save'))
					.setCta()
					.onClick(() => {
						if (busy) return;
						busy = true;
						button.setDisabled(true);
						void this.create(name)
							.then(() => this.close())
							.catch((reason: unknown) => {
								error.setText(errorText(reason));
								field.focus();
							})
							.finally(() => {
								busy = false;
								button.setDisabled(false);
							});
					}),
			);
	}
	onClose(): void {
		this.contentEl.empty();
	}
}
