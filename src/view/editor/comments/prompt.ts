import { App, Modal } from 'obsidian';
import { onLanguageChanged, t } from '../../../shared/i18n/index';
import { commentShortcut } from './composer';

/** Small text prompt. Resolves null when cancelled. Does not touch the note. */
export function askText(app: App, title: string, placeholder: string): Promise<string | null> {
	return new Promise((resolve) => {
		const modal = new TextPromptModal(app, title, placeholder, resolve);
		modal.open();
	});
}

class TextPromptModal extends Modal {
	private settled = false;
	private offLanguage: (() => void) | null = null;

	constructor(
		app: App,
		private readonly titleText: string,
		private readonly placeholder: string,
		private readonly done: (value: string | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.containerEl.addClass('nand-editor-comment-prompt-host');
		const title = contentEl.createEl('h3', { text: t(this.titleText), cls: 'nand-editor-comment-prompt-title' });
		const input = contentEl.createEl('textarea', { cls: 'nand-editor-comment-prompt' });
		input.placeholder = t(this.placeholder);
		input.rows = 4;
		const hint = contentEl.createDiv({ cls: 'nand-editor-comment-shortcut' });
		const row = contentEl.createDiv({ cls: 'nand-editor-comment-prompt-row' });
		const cancel = row.createEl('button', {
			text: t('editor.comments.cancel'),
			cls: 'nand-ui-btn nand-ui-btn-ghost',
		});
		const ok = row.createEl('button', { text: t('editor.comments.save'), cls: 'mod-cta nand-ui-btn' });
		cancel.addEventListener('click', () => this.finish(null));
		const submit = () => {
			const value = input.value.trim();
			if (value) this.finish(value);
		};
		ok.addEventListener('click', submit);
		const sync = () => {
			ok.disabled = !input.value.trim();
		};
		input.addEventListener('input', sync);
		this.scope.register(['Mod'], 'Enter', (event) => {
			if (!event.isComposing) submit();
			return false;
		});
		const translate = () => {
			title.textContent = t(this.titleText);
			input.placeholder = t(this.placeholder);
			input.setAttribute('aria-label', t(this.placeholder));
			hint.textContent = commentShortcut();
			cancel.textContent = t('editor.comments.cancel');
			ok.textContent = t('editor.comments.submit');
		};
		this.offLanguage = onLanguageChanged(translate);
		translate();
		sync();
		input.focus();
	}

	onClose(): void {
		this.offLanguage?.();
		this.offLanguage = null;
		this.contentEl.empty();
		if (!this.settled) {
			this.settled = true;
			this.done(null);
		}
	}

	private finish(value: string | null): void {
		if (this.settled) return;
		this.settled = true;
		this.done(value);
		this.close();
	}
}
