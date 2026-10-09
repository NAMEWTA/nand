import { Menu } from 'obsidian';

export interface MenuEntry {
	title: string;
	icon?: string;
	/** Draws a separator before this entry. */
	section?: boolean;
	danger?: boolean;
	checked?: boolean;
	disabled?: boolean;
	run: () => void | Promise<void>;
}

/** Show an Obsidian menu at a mouse event or below an element. */
export function showMenu(anchor: MouseEvent | HTMLElement, entries: readonly MenuEntry[], report: (error: unknown) => void = (error) => console.error('[NAND menu]', error)): Menu {
	const menu = new Menu();
	entries.forEach((entry, index) => {
		if (entry.section && index > 0) menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle(entry.title).setDisabled(entry.disabled ?? false).onClick(() => {
				void Promise.resolve(entry.run()).catch(report);
			});
			if (entry.icon) item.setIcon(entry.icon);
			if (entry.checked !== undefined) item.setChecked(entry.checked);
			if (entry.danger) item.setWarning(true);
		});
	});
	if (anchor instanceof MouseEvent) menu.showAtMouseEvent(anchor);
	else {
		const rect = anchor.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 }, anchor.ownerDocument);
	}
	return menu;
}
