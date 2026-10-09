import { bindLocalizedElement } from '../../../../ui/primitives/localized-dom';
import type { App } from 'obsidian';
import { t } from '../../../../shared/i18n/index';
import { applyModalTheme } from '../appearance/modal-theme';
import { ownDialog } from './dialog-scope';

interface PromptOptions {
	title: string;
	placeholder?: string;
	defaultValue?: string;
}

/**
 * Lightweight text-input dialog: the `dashboard-confirm-*` counterpart to a
 * native `prompt()`. Resolves to the trimmed value, or `null` if cancelled.
 * Used instead of `prompt()`, which is disallowed by the `no-alert` lint rule.
 */
export function showPromptDialog(app: App | undefined, options: PromptOptions): Promise<string | null> {
	const doc = activeDocument;
	return new Promise((resolve) => {
		let release = () => {};
		let resolved = false;

		const overlay = doc.body.createDiv({ cls: 'dashboard-confirm-overlay' });
		const dialog = overlay.createDiv({ cls: 'dashboard-confirm-card' });
		applyModalTheme(dialog);

		dialog.createEl('h3', { text: options.title, cls: 'dashboard-confirm-title' });

		const input = dialog.createEl('input', { cls: 'dashboard-prompt-input', attr: { type: 'text' } });
		input.placeholder = options.placeholder ?? '';
		input.value = options.defaultValue ?? '';

		function finish(value: string | null): void {
			if (resolved) return;
			resolved = true;
			release();
			win.clearTimeout(timer);
			overlay.remove();
			doc.removeEventListener('keydown', onKeydown);
			resolve(value);
		}

		function submit(): void {
			const value = input.value.trim();
			finish(value.length > 0 ? value : null);
		}

		function onKeydown(e: KeyboardEvent): void {
			if (e.key === 'Escape') finish(null);
		}

		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				submit();
			}
		});

		const actions = dialog.createDiv({ cls: 'dashboard-confirm-actions' });

		const cancelBtn = bindLocalizedElement(actions.createEl('button', {
			text: t('common.cancel'),
			cls: 'dashboard-confirm-cancel',
		}), 'common.cancel');
		cancelBtn.addEventListener('click', () => finish(null));

		const confirmBtn = bindLocalizedElement(actions.createEl('button', {
			text: t('common.save'),
			cls: 'dashboard-confirm-confirm',
		}), 'common.save');
		confirmBtn.addEventListener('click', submit);

		overlay.addEventListener('click', (e) => {
			if (e.target === overlay) finish(null);
		});

		doc.addEventListener('keydown', onKeydown);

		release = ownDialog(app, () => finish(null));
		// Defer focus until the input is laid out.
		const win = doc.defaultView!;
		const timer = win.setTimeout(() => {
			if (resolved) return;
			input.focus();
			input.select();
		}, 0);
	});
}
