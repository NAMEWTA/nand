import { setIcon } from 'obsidian';

export interface EmptyStateOptions {
	icon: string;
	title: string;
	description: string;
	layout?: 'fill' | 'content';
	action?: { label: string; run: () => void };
}

/** Presentation only: the owning surface supplies all copy and actions. */
export function renderEmptyState(parent: HTMLElement, options: EmptyStateOptions): HTMLElement {
	const root = parent.createDiv({ cls: 'nand-empty-state' });
	if (options.layout === 'content') root.addClass('nand-empty-state--content');
	const icon = root.createDiv({ cls: 'nand-empty-state-icon', attr: { 'aria-hidden': 'true' } });
	setIcon(icon, options.icon);
	root.createDiv({ cls: 'nand-empty-state-title', text: options.title });
	root.createDiv({ cls: 'nand-empty-state-description', text: options.description });
	if (options.action) {
		const action = options.action;
		const button = root.createEl('button', { text: action.label, attr: { type: 'button' } });
		button.addEventListener('click', action.run);
	}
	return root;
}
