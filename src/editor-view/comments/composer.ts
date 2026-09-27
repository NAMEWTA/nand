import { Notice, Platform, Scope, type App } from 'obsidian';
import { onLanguageChanged, t } from '../../shared/i18n';

export function commentShortcut(): string {
	return t('editor.comments.shortcut', { modifier: Platform.isMacOS ? '⌘' : 'Ctrl' });
}

/** A temporary key scope belongs to this composer, never to the note editor. */
export function mountCommentComposer(
	parent: HTMLElement,
	app: App,
	save: (text: string) => Promise<void>,
	focusEditor: () => void,
): () => void {
	const button = parent.createEl('button', { cls: 'nand-editor-comment-popover-btn', attr: { type: 'button' } });
	const input = parent.createEl('textarea', { cls: 'nand-editor-comment-popover-input' });
	const hint = parent.createDiv({ cls: 'nand-editor-comment-shortcut' });
	const actions = parent.createDiv({ cls: 'nand-editor-comment-composer-actions' });
	const cancel = actions.createEl('button', { attr: { type: 'button' } });
	const submit = actions.createEl('button', { cls: 'mod-cta', attr: { type: 'button' } });
	let editing = false,
		pending = false,
		disposed = false,
		pushed = false;
	let scope: Scope | null = null;
	const win = parent.ownerDocument.defaultView;
	const release = () => {
		if (scope && pushed) app.keymap.popScope(scope);
		pushed = false;
	};
	const acquire = () => {
		if (!editing || pushed) return;
		if (!scope) {
			scope = new Scope(app.scope);
			scope.register(['Mod'], 'Enter', (event) => {
				if (!event.isComposing) void commit();
				return false;
			});
			scope.register([], 'Escape', (event) => {
				if (!event.isComposing) close();
				return false;
			});
		}
		app.keymap.pushScope(scope);
		pushed = true;
	};
	const sync = () => {
		button.hidden = editing;
		input.hidden = hint.hidden = actions.hidden = !editing;
		submit.disabled = pending || !input.value.trim();
		input.disabled = cancel.disabled = pending;
	};
	const close = () => {
		if (pending) return;
		editing = false;
		input.value = '';
		release();
		sync();
		focusEditor();
	};
	const commit = async () => {
		const text = input.value.trim();
		if (!text || pending || disposed) return;
		pending = true;
		sync();
		try {
			await save(text);
			if (!disposed) {
				pending = false;
				close();
			}
		} catch {
			if (!disposed) new Notice(t('editor.comments.saveFailed'));
		} finally {
			pending = false;
			if (!disposed) sync();
		}
	};
	const translate = () => {
		button.textContent = t('editor.comments.popover');
		input.placeholder = t('editor.comments.placeholder');
		input.setAttribute('aria-label', t('editor.comments.placeholder'));
		hint.textContent = commentShortcut();
		cancel.textContent = t('editor.comments.cancel');
		submit.textContent = t('editor.comments.submit');
	};
	button.addEventListener('mousedown', (event) => event.preventDefault());
	button.addEventListener('click', () => {
		editing = true;
		sync();
		input.focus();
		acquire();
	});
	input.addEventListener('input', sync);
	cancel.addEventListener('click', close);
	submit.addEventListener('click', () => {
		void commit();
	});
	const focusIn = () => acquire();
	const focusOut = (event: FocusEvent) => {
		if (!event.relatedTarget || !parent.contains(event.relatedTarget as Node)) release();
	};
	parent.addEventListener('focusin', focusIn);
	parent.addEventListener('focusout', focusOut);
	const windowFocus = () => {
		if (parent.contains(parent.ownerDocument.activeElement)) acquire();
	};
	win?.addEventListener('blur', release);
	win?.addEventListener('focus', windowFocus);
	const offLanguage = onLanguageChanged(translate);
	translate();
	sync();
	return () => {
		disposed = true;
		release();
		offLanguage();
		parent.removeEventListener('focusin', focusIn);
		parent.removeEventListener('focusout', focusOut);
		win?.removeEventListener('blur', release);
		win?.removeEventListener('focus', windowFocus);
	};
}
