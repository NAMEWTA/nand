import { Menu, MenuItem, MenuPositionDef } from 'obsidian';
import { getMethod, internalMenu, internalMenuItem } from '../utils/obsidian-internal';

/**
 * Intercepts context menus to add custom items.
 */
export default class MenuManager {
	private menu: Menu | null = null;
	private queuedActions: (() => void)[] = [];
	private showAtPositionOriginal: (position: MenuPositionDef, doc?: Document) => Menu;
	private showAtPositionProxy: (this: void, position: MenuPositionDef, doc?: Document) => Menu;

	constructor() {
		// Store original method
		this.showAtPositionOriginal = getMethod(Menu.prototype, 'showAtPosition');

		// Catch menus as they open
		this.showAtPositionProxy = new Proxy(getMethod(Menu.prototype, 'showAtPosition'), {
			apply: (showAtPosition, menu: Menu, args: [position: MenuPositionDef, doc?: Document]) => {
				this.menu = menu;
				if (this.queuedActions.length > 0) {
					this.runQueuedActions(); // Menu is unhappy with your customer service
				}
				return showAtPosition.call(menu, ...args);
			},
		});

		// Replace original method
		Menu.prototype.showAtPosition = this.showAtPositionProxy;
	}

	/**
	 * Run all actions in the queue.
	 */
	private runQueuedActions(): void {
		const actions = this.queuedActions;
		this.queuedActions = []; // Reassign property to avoid an infinite loop
		for (const action of actions) action();
	}

	/**
	 * Add a menu item.
	 */
	addItem(callback: (item: MenuItem) => void): this {
		if (this.menu) {
			this.menu.addItem(callback);
		} else {
			this.queuedActions.push(() => this.addItem(callback));
		}
		return this;
	}

	/**
	 * Add a menu item after the given sections, prioritized by array order.
	 */
	addItemAfter(preSections: string | string[], callback: (item: MenuItem) => void): this {
		if (this.menu) {
			if (typeof preSections === 'string') preSections = [preSections];

			this.menu.addItem((item) => {
				callback(item);

				const section: string = internalMenuItem(item).section;

				const sections: string[] = (this.menu ? internalMenu(this.menu).sections : undefined) ?? [];

				let index = 0;
				for (const preSection of preSections) {
					if (sections.includes(preSection)) {
						index = sections.lastIndexOf(preSection) + 1;
						break;
					}
				}
				sections.remove(section);
				sections.splice(index, 0, section);
			});
		} else {
			this.queuedActions.push(() => this.addItemAfter(preSections, callback));
		}
		return this;
	}

	/**
	 * Add a separator.
	 */
	addSeparator(): this {
		if (this.menu) {
			this.menu.addSeparator();
		} else {
			this.queuedActions.push(() => this.addSeparator());
		}
		return this;
	}

	/**
	 * Iterate menu items of a given section.
	 */
	forSection(section: string, callback: (item: MenuItem, index: number) => void): this {
		if (this.menu) {
			const items = internalMenu(this.menu).items.filter((item) => internalMenuItem(item).section === section);
			items.forEach((item, i) => callback(item, i));
		} else {
			this.queuedActions.push(() => this.forSection(section, callback));
		}
		return this;
	}

	/**
	 * Flush any queued actions from a previous menu.
	 */
	flush(): void {
		this.queuedActions.length = 0;
	}

	/**
	 * Close menu and flush any queued actions.
	 */
	closeAndFlush(): void {
		this.menu?.close();
		this.menu = null;
		this.flush();
	}

	/**
	 * Revert proxy to original method if possible.
	 */
	unload(): void {
		if (Menu.prototype.showAtPosition === this.showAtPositionProxy) {
			Menu.prototype.showAtPosition = this.showAtPositionOriginal;
		}
	}
}
