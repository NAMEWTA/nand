import { Modal, type App } from 'obsidian';
import { render, type ComponentChildren } from 'preact';

export interface DialogOptions {
	title: string;
	/** Dialog body; receives `close` so actions can dismiss the dialog. */
	content: (close: () => void) => ComponentChildren;
	/** Footer actions (buttons); receives `close`. */
	footer?: (close: () => void) => ComponentChildren;
	className?: string;
	onClose?: () => void;
}

/** An Obsidian modal whose body is a Preact view (unmounted when the modal closes). */
export function openDialog(app: App, options: DialogOptions): () => void {
	const modal = new (class extends Modal {
		onOpen(): void {
			this.modalEl.addClass('nand-dialog');
			if (options.className) this.modalEl.addClass(options.className);
			this.setTitle(options.title);
			const close = () => this.close();
			render(
				<>
					<div class="nand-dialog-body">{options.content(close)}</div>
					{options.footer && <div class="nand-dialog-footer">{options.footer(close)}</div>}
				</>,
				this.contentEl,
			);
		}
		onClose(): void {
			render(null, this.contentEl);
			options.onClose?.();
		}
	})(app);
	modal.open();
	return () => modal.close();
}
