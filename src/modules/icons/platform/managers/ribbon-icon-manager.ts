import { Menu, Platform } from 'obsidian';
import { t } from '../../../../shared/i18n';
import type IconicController from '../host/controller';
import { internalApp, internalMenuItem } from '../utils/obsidian-internal';
import type { RibbonItem } from '../view-types';
import IconManager from './icon-manager';
import MenuManager from './menu-manager';

/**
 * Handles icons in the app ribbon.
 */
export default class RibbonIconManager extends IconManager {
	constructor(plugin: IconicController) {
		super(plugin);
		this.refreshIcons();

		const containerEl: HTMLElement = internalApp(this.app).workspace.leftRibbon.ribbonItemsEl;

		// Prevent ribbon from eating auxclick events
		this.setEventListener(
			containerEl,
			'auxclick',
			(event) => {
				event.stopPropagation();
			},
			{ capture: true },
		);
		this.setMutationsObserver(containerEl, { childList: true }, () => this.refreshIcons());

		// Refresh ribbon context menu
		const ribbonEl = activeDocument.body.find(
			Platform.isDesktop
				? '.side-dock-ribbon.mod-left.workspace-ribbon'
				: '.side-dock-ribbon.mod-left.workspace-drawer-ribbon',
		);
		if (ribbonEl)
			this.setEventListener(ribbonEl, 'contextmenu', () => {
				const ribbonItems = this.plugin.getRibbonItems();
				this.plugin.menuManager?.forSection('order', (item) => {
					const firstItem = ribbonItems.first();

					if (firstItem && internalMenuItem(item).iconEl.childElementCount > 0) {
						// Ribbon Divider compatibility
						item.setIcon(firstItem.icon);

						this.refreshIcon(firstItem, internalMenuItem(item).iconEl);
						ribbonItems.shift();
					}
				});
			});

		// Watch for ribbon configuration dialog
		this.setMutationObserver(activeDocument.body, { childList: true }, (mutation) => {
			for (const addedNode of Array.from(mutation.addedNodes)) {
				// Very fragile dialog detection
				if (
					addedNode.instanceOf(HTMLElement) &&
					addedNode.hasClass('modal-container') &&
					addedNode.find('.modal-content > div > .mobile-option-setting-item') &&
					addedNode.find('.modal-content > .modal-button-container')
				) {
					this.refreshConfigIcons(addedNode);
				}
			}
		});
	}

	/**
	 * @override
	 * Refresh all ribbon icons.
	 */
	refreshIcons(unloading?: boolean): void {
		if (Platform.isPhone) {
			const ribbonButtonEl = internalApp(this.app).mobileNavbar.ribbonMenuItemEl;
			if (!ribbonButtonEl) return;

			const quickItemId = internalApp(this.app).vault.getConfig('mobileQuickRibbonItem');
			const ribbonButtonListener = () => {
				const firstRibItem = this.plugin.getRibbonItems().filter((item) => !item.isHidden);
				this.plugin.menuManager?.forSection('', (item) => {
					const ribbonItem = firstRibItem[0];
					if (ribbonItem) {
						item.setIcon(ribbonItem.icon);

						this.refreshIcon(ribbonItem, internalMenuItem(item).iconEl);
						firstRibItem.shift();
					}
				});
			};
			if (quickItemId) {
				const quickItem = this.plugin.getRibbonItem(quickItemId);
				if (quickItem) {
					if (this.plugin.settings.uncolorQuick) quickItem.color = null;
					this.refreshIcon(quickItem, ribbonButtonEl);
				}
			} else {
				this.setEventListener(ribbonButtonEl, 'click', ribbonButtonListener);
			}
			this.setEventListener(ribbonButtonEl, 'contextmenu', ribbonButtonListener);
		}

		const ribbonItems = this.plugin.getRibbonItems(unloading);
		for (const ribbonItem of ribbonItems) {
			const iconEl = ribbonItem.iconEl;
			if (!iconEl || iconEl.hasClass('ribbon-divider')) {
				// Ribbon Divider compatibility
				continue;
			}
			if (ribbonItem.isHidden) {
				ribbonItem.icon = null;
				ribbonItem.iconDefault = null;
			}
			this.refreshIcon(ribbonItem, iconEl);

			// Add context menu
			if (this.plugin.settings.showMenuActions) {
				this.setEventListener(
					iconEl,
					'contextmenu',
					(event) => {
						this.onContextMenu(ribbonItem.id, event);
					},
					{ capture: true },
				);
			} else {
				this.stopEventListener(iconEl, 'contextmenu');
			}
		}
	}

	/**
	 * Refresh all icons in the ribbon configuration dialog.
	 */
	private refreshConfigIcons(containerEl: HTMLElement): void {
		if (Platform.isPhone) {
			const quickDropdownEl = containerEl.find('.setting-item-control > .dropdown');
			if (quickDropdownEl)
				this.setEventListener(quickDropdownEl, 'change', () => {
					this.plugin.refreshManagers('ribbon');
					this.refreshConfigIcons(containerEl);
				});

			const quickItemId = internalApp(this.app).vault.getConfig('mobileQuickRibbonItem');
			if (quickItemId) {
				const quickItem = this.plugin.getRibbonItem(quickItemId);
				if (quickItem) {
					const quickIconEl = containerEl.find('.setting-item-control > .extra-setting-button');
					this.refreshIcon(quickItem, quickIconEl, () => {
						this.plugin.dialogsPort.openSingle(quickItem, (newIcon, newColor) => {
							this.plugin.saveRibbonIcon(quickItem, newIcon, newColor);
							this.plugin.refreshManagers('ribbon');
							this.refreshConfigIcons(containerEl);
						});
					});
				}
			}
		}

		const iconEls = containerEl.findAll(
			'.mobile-option-setting-item-option-icon:not(.mobile-option-setting-drag-icon)',
		);
		if (iconEls.length === 0) return;

		const ribbonItems = this.plugin.getRibbonItems();
		const visibleItems = ribbonItems.filter((item) => !item.isHidden);
		const hiddenItems = ribbonItems.filter((item) => item.isHidden);
		const visibleEls = containerEl.findAll(
			'.mobile-option-setting-item:has(.mobile-option-setting-item-remove-icon)',
		);
		const hiddenEls = containerEl.findAll('.mobile-option-setting-item:has(.mobile-option-setting-item-add-icon)');

		const configItems = [
			...visibleItems.map(
				(item, i) =>
					[item, visibleEls[i], 'mobile-option-setting-item-remove-icon'] as [
						RibbonItem,
						HTMLElement,
						string,
					],
			),
			...hiddenItems.map(
				(item, i) =>
					[item, hiddenEls[i], 'mobile-option-setting-item-add-icon'] as [RibbonItem, HTMLElement, string],
			),
		];

		for (const [item, itemEl, buttonClass] of configItems) {
			const iconEl = itemEl.find(':scope > .mobile-option-setting-item-option-icon');
			if (!iconEl || iconEl.childElementCount === 0) {
				// Ribbon Divider compatibility
				continue;
			}
			const buttonEl = itemEl.find(':scope > .' + buttonClass);
			this.refreshIcon(item, iconEl, (event) => {
				this.plugin.dialogsPort.openSingle(item, (newIcon, newColor) => {
					this.plugin.saveRibbonIcon(item, newIcon, newColor);
					this.plugin.refreshManagers('ribbon');
					this.refreshConfigIcons(containerEl);
				});
				event.stopPropagation();
			});
			this.setEventListener(buttonEl, 'click', () => this.refreshConfigIcons(containerEl));
		}
	}

	/**
	 * When user context-clicks a ribbon command, open a menu.
	 */
	private onContextMenu(ribbonItemId: string, event: MouseEvent): void {
		navigator.vibrate?.(100); // Not supported on iOS
		this.plugin.menuManager?.closeAndFlush();
		const ribbonItem = this.plugin.getRibbonItem(ribbonItemId);
		if (!ribbonItem) return;

		// Menu compatibility with Periodic Notes plugin
		let menu: Menu | MenuManager | undefined;
		if (ribbonItemId.startsWith('periodic-notes:')) {
			menu = this.plugin.menuManager;
			menu?.forSection('', (menuItem) => menuItem.setSection('open'));
		} else {
			menu = new Menu();
		}

		// Change icon
		menu?.addItem((menuItem) =>
			menuItem
				.setTitle(t('iconic.menu.changeIcon'))
				.setIcon('lucide-image-plus')
				.setSection('icon')
				.onClick(() =>
					this.plugin.dialogsPort.openSingle(ribbonItem, (newIcon, newColor) => {
						this.plugin.saveRibbonIcon(ribbonItem, newIcon, newColor);
						this.plugin.refreshManagers('ribbon');
					}),
				),
		);

		// Remove icon / Reset color
		if (ribbonItem.icon || ribbonItem.color) {
			menu?.addItem((menuItem) =>
				menuItem
					.setTitle(ribbonItem.icon ? t('iconic.menu.removeIcon') : t('iconic.menu.resetColor'))
					.setIcon(ribbonItem.icon ? 'lucide-image-minus' : 'lucide-rotate-ccw')
					.setSection('icon')
					.onClick(() => {
						this.plugin.saveRibbonIcon(ribbonItem, null, null);
						this.plugin.refreshManagers('ribbon');
					}),
			);
		}

		if (menu instanceof Menu) menu.showAtMouseEvent(event);
	}

	/**
	 * @override
	 */
	unload(): void {
		this.refreshIcons(true);
	}
}
