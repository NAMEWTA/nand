import { bindLocalizedControl } from '../../../../ui/primitives/localized-dom';
import { ButtonComponent, Hotkey, Modal, Platform, Setting } from 'obsidian';
import type { Category, Item } from '../../core/types';
import type IconicController from '../../platform/host/controller';
import { RuleItem } from '../../platform/managers/rule-manager';
import { EMOJIS, ICONS, loadResources } from '../../platform/resources';
import { internalApp, isHtmlElement } from '../../platform/utils/obsidian-internal';
import { t } from '../../../../shared/i18n';
import CalloutComponent from '../components/callout-component';
import IconColorComponent from '../components/icon-color-component';
import IconColorResetComponent from '../components/icon-color-reset-component';
import IconSearchComponent, { IconSearchResult } from '../components/icon-search-component';
import IconSearchResultsSetting from '../components/icon-search-results-setting';
import ToggleButtonComponent from '../components/toggle-button-component';

/**
 * Callback for setting icon & color of a single item.
 */
export interface IconPickerCallback {
	(icon: string | null, color: string | null): void;
}

/**
 * Callback for setting icons & colors of multiple items at once.
 */
export interface MultiIconPickerCallback {
	(icon: string | null | undefined, color: string | null | undefined): void;
}

/**
 * Dialog for changing icons & colors of single/multiple items.
 */
export default class IconPicker extends Modal {
	private readonly plugin: IconicController;

	// Item
	private readonly items: Item[];
	private readonly icon: string | null | undefined;
	private color: string | null | undefined;
	private readonly callback: IconPickerCallback | null;
	private readonly multiCallback: MultiIconPickerCallback | null;

	// Components
	private overruleCallout!: CalloutComponent;
	private searchSetting!: Setting;
	private resultsSetting!: IconSearchResultsSetting;
	private resetButton!: IconColorResetComponent;
	private colorPicker!: IconColorComponent;
	private searchField!: IconSearchComponent;

	// State
	private searchResults: IconSearchResult[] = [];

	private constructor(
		plugin: IconicController,
		items: Item[],
		callback: IconPickerCallback | null,
		multiCallback: MultiIconPickerCallback | null,
	) {
		super(plugin.app);
		this.plugin = plugin;
		plugin.trackDialog(this);
		this.items = items;
		const firstItem = this.items.first();
		if (firstItem) {
			this.icon = this.items.every((item) => item.icon === firstItem.icon) ? firstItem.icon : undefined;
			this.color = this.items.every((item) => item.color === firstItem.color) ? firstItem.color : undefined;
		}
		this.callback = callback;
		this.multiCallback = multiCallback;

		// Allow hotkeys in dialog
		for (const command of this.plugin.dialogCommands)
			if (command.callback) {
				const hotkeys: Hotkey[] = internalApp(this.app).hotkeyManager?.customKeys?.[command.id] ?? [];
				for (const hotkey of hotkeys) {
					this.scope.register(hotkey.modifiers, hotkey.key, command.callback);
				}
			}

		// Navigation hotkeys
		this.scope.register(null, 'ArrowUp', (event) => this.nudgeFocus(event));
		this.scope.register(null, 'ArrowDown', (event) => this.nudgeFocus(event));
		this.scope.register(null, 'ArrowLeft', (event) => this.nudgeFocus(event));
		this.scope.register(null, 'ArrowRight', (event) => this.nudgeFocus(event));
		this.scope.register(null, 'Enter', (event) => this.confirmFocus(event));
		this.scope.register(null, ' ', (event) => this.confirmFocus(event));
		this.scope.register(null, 'Delete', (event) => this.deleteFocus(event));
		this.scope.register(null, 'Backspace', (event) => this.deleteFocus(event));
	}

	/**
	 * Nudge the focused element.
	 */
	private nudgeFocus(event: KeyboardEvent): void {
		if (!isHtmlElement(event.target)) return;
		let focusEl: Element | null = null;

		switch (event.key) {
			case 'ArrowUp':
				return; // Upstream 1.1.10 reads previousColor without invoking it.
			case 'ArrowDown':
				this.colorPicker.nextColor();
				return;
			case 'ArrowLeft': {
				// Search results
				if (this.resultsSetting.settingEl.contains(event.target)) {
					if (event.target !== this.resultsSetting.settingEl && event.target.previousElementSibling) {
						focusEl = event.target.previousElementSibling;
					} else if (!event.repeat) {
						focusEl = this.resultsSetting.controlEl.lastElementChild;
					}
				}
				break;
			}
			case 'ArrowRight': {
				// Search results
				if (this.resultsSetting.settingEl.contains(event.target)) {
					if (event.target !== this.resultsSetting.settingEl && event.target.nextElementSibling) {
						focusEl = event.target.nextElementSibling;
					} else if (!event.repeat) {
						focusEl = this.resultsSetting.controlEl.firstElementChild;
					}
				}
			}
		}

		if (focusEl?.instanceOf(HTMLElement)) {
			event.preventDefault();
			focusEl.focus();
		}
	}

	/**
	 * Confirm the focused element.
	 */
	private confirmFocus(event: KeyboardEvent): void {
		if (!isHtmlElement(event.target)) return;

		// Extra setting buttons
		if (event.target.hasClass('extra-setting-button')) {
			event.preventDefault();
			event.target.click();
		}
		// Color picker
		else if (event.target === this.colorPicker.colorEl) {
			event.preventDefault();
			const rect = this.colorPicker.colorEl.getBoundingClientRect();
			const x = rect.x + rect.width / 4;
			const y = rect.y + rect.height / 4;
			this.colorPicker.showColorOptions(x, y);
		}
		// Search field
		else if (event.target === this.searchField.inputEl && event.key === 'Enter') {
			const [firstResultIcon] = this.searchResults.first() ?? [];
			if (firstResultIcon) {
				event.preventDefault();
				this.closeAndSave(firstResultIcon, this.color);
			}
		}
	}

	/**
	 * Delete the focused element.
	 */
	private deleteFocus(event: KeyboardEvent): void {
		if (!isHtmlElement(event.target)) return;

		// Anywhere except the search field
		if (event.target !== this.searchField.inputEl) {
			if (event.target === this.resetButton.extraSettingsEl) this.colorPicker.colorEl?.focus();
			this.colorPicker.setColor(null);
		}
	}

	/**
	 * Open a dialog to change a single icon.
	 */
	static openSingle(plugin: IconicController, item: Item, callback: IconPickerCallback): void {
		// Search keywords and emoji names load on first use.
		void loadResources().then(() => new IconPicker(plugin, [item], callback, null).open(), (error: unknown) => console.error('[NAND icons] resources', error));
	}

	/**
	 * Open a dialog to change multiple icons at once.
	 */
	static openMulti(plugin: IconicController, items: Item[], multiCallback: MultiIconPickerCallback): void {
		void loadResources().then(() => new IconPicker(plugin, items, null, multiCallback).open(), (error: unknown) => console.error('[NAND icons] resources', error));
	}

	/**
	 * @override
	 */
	onOpen(): void {
		const { dialogState } = this.plugin.settings;
		this.containerEl.addClass('mod-confirmation');
		this.modalEl.addClass('iconic-icon-picker');
		bindLocalizedControl(this.setTitle(
			this.items.length === 1
				? t('iconic.iconPicker.changeIcon')
				: t('iconic.iconPicker.changeIcons').replace('{#}', this.items.length.toString()),
		), "title", this.items.length === 1 ? ("iconic.iconPicker.changeIcon") : ("iconic.iconPicker.changeIcons"), (this.items.length === 1) ? (undefined) : ({"#": this.items.length.toString()}));

		// CALLOUT: Overrule callout
		this.overruleCallout = new CalloutComponent(this.contentEl);
		this.updateOverruleCallout();

		// SETTING: Item name
		const showItemName =
			this.plugin.settings.showItemName === 'on' ||
			(Platform.isDesktop && this.plugin.settings.showItemName === 'desktop') ||
			(Platform.isMobile && this.plugin.settings.showItemName === 'mobile');
		if (showItemName) {
			const setting = new Setting(this.contentEl)
				.addText((itemNameField) => itemNameField.setValue(this.items.map((item) => item.name).join(', ')))
				.setDisabled(true);
			const firstItem = this.items.first();
			const category =
				firstItem && this.items.every((item) => item.category === firstItem.category)
					? firstItem.category
					: null;
			if (this.items.length === 1)
				switch (category) {
					default:
						bindLocalizedControl(setting.setName(t('iconic.categories.item')), "name", "iconic.categories.item");
						break;
					case 'app':
						bindLocalizedControl(setting.setName(t('iconic.categories.appItem')), "name", "iconic.categories.appItem");
						break;
					case 'tab':
						bindLocalizedControl(setting.setName(t('iconic.categories.tab')), "name", "iconic.categories.tab");
						break;
					case 'file':
						bindLocalizedControl(setting.setName(t('iconic.categories.file')), "name", "iconic.categories.file");
						break;
					case 'folder':
						bindLocalizedControl(setting.setName(t('iconic.categories.folder')), "name", "iconic.categories.folder");
						break;
					case 'group':
						bindLocalizedControl(setting.setName(t('iconic.categories.group')), "name", "iconic.categories.group");
						break;
					case 'search':
						bindLocalizedControl(setting.setName(t('iconic.categories.search')), "name", "iconic.categories.search");
						break;
					case 'graph':
						bindLocalizedControl(setting.setName(t('iconic.categories.graph')), "name", "iconic.categories.graph");
						break;
					case 'url':
						bindLocalizedControl(setting.setName(t('iconic.categories.url')), "name", "iconic.categories.url");
						break;
					case 'tag':
						bindLocalizedControl(setting.setName(t('iconic.categories.tag')), "name", "iconic.categories.tag");
						break;
					case 'property':
						bindLocalizedControl(setting.setName(t('iconic.categories.property')), "name", "iconic.categories.property");
						break;
					case 'ribbon':
						bindLocalizedControl(setting.setName(t('iconic.categories.ribbonItem')), "name", "iconic.categories.ribbonItem");
						break;
					case 'rule':
						bindLocalizedControl(setting.setName(t('iconic.categories.rule')), "name", "iconic.categories.rule");
						break;
				}
			else
				switch (category) {
					default:
						bindLocalizedControl(setting.setName(t('iconic.categories.items')), "name", "iconic.categories.items");
						break;
					case 'app':
						bindLocalizedControl(setting.setName(t('iconic.categories.appItems')), "name", "iconic.categories.appItems");
						break;
					case 'tab':
						bindLocalizedControl(setting.setName(t('iconic.categories.tabs')), "name", "iconic.categories.tabs");
						break;
					case 'file':
						bindLocalizedControl(setting.setName(t('iconic.categories.files')), "name", "iconic.categories.files");
						break;
					case 'folder':
						bindLocalizedControl(setting.setName(t('iconic.categories.folders')), "name", "iconic.categories.folders");
						break;
					case 'group':
						bindLocalizedControl(setting.setName(t('iconic.categories.groups')), "name", "iconic.categories.groups");
						break;
					case 'search':
						bindLocalizedControl(setting.setName(t('iconic.categories.searches')), "name", "iconic.categories.searches");
						break;
					case 'graph':
						bindLocalizedControl(setting.setName(t('iconic.categories.graphs')), "name", "iconic.categories.graphs");
						break;
					case 'url':
						bindLocalizedControl(setting.setName(t('iconic.categories.urls')), "name", "iconic.categories.urls");
						break;
					case 'tag':
						bindLocalizedControl(setting.setName(t('iconic.categories.tags')), "name", "iconic.categories.tags");
						break;
					case 'property':
						bindLocalizedControl(setting.setName(t('iconic.categories.properties')), "name", "iconic.categories.properties");
						break;
					case 'ribbon':
						bindLocalizedControl(setting.setName(t('iconic.categories.ribbonItems')), "name", "iconic.categories.ribbonItems");
						break;
					case 'rule':
						bindLocalizedControl(setting.setName(t('iconic.categories.rules')), "name", "iconic.categories.rules");
						break;
				}
		}

		// SETTING: Search
		this.searchSetting = new Setting(this.contentEl)
			.addComponent((controlEl) =>
				bindLocalizedControl(new IconColorResetComponent(controlEl)
					.setTooltip(t('iconic.iconPicker.resetColor'), { delay: 300 }), "tooltip", "iconic.iconPicker.resetColor")
					.onClick(() => this.colorPicker.setColor(null))
					.then((component) => {
						component.toggleVisibility(this.color !== null);
						this.resetButton = component;
					}),
			)
			.addComponent((controlEl) =>
				new IconColorComponent(controlEl)
					.setColor(this.color ?? null)
					.setColorOptions({
						red: t('iconic.iconPicker.colors.red'),
						orange: t('iconic.iconPicker.colors.orange'),
						yellow: t('iconic.iconPicker.colors.yellow'),
						green: t('iconic.iconPicker.colors.green'),
						cyan: t('iconic.iconPicker.colors.cyan'),
						blue: t('iconic.iconPicker.colors.blue'),
						purple: t('iconic.iconPicker.colors.purple'),
						pink: t('iconic.iconPicker.colors.pink'),
						gray: t('iconic.iconPicker.colors.gray'),
					})
					.onColorChange((color) => {
						this.color = color;
						this.resetButton.toggleVisibility(color !== null);
						this.resultsSetting.setColor(color);
					})
					.then((component) => {
						if (
							this.plugin.settings.colorPicker1 === 'list' ||
							this.plugin.settings.colorPicker1 === 'rgb'
						) {
							component.setPrimaryMode(this.plugin.settings.colorPicker1);
						}
						if (
							this.plugin.settings.colorPicker2 === 'list' ||
							this.plugin.settings.colorPicker2 === 'rgb'
						) {
							component.setSecondaryMode(this.plugin.settings.colorPicker2);
						}
						this.colorPicker = component;
					}),
			)
			.addComponent((controlEl) =>
				bindLocalizedControl(new IconSearchComponent(controlEl)
					.setPlaceholder(t('iconic.iconPicker.searchIcons')), "placeholder", "iconic.iconPicker.searchIcons")
					.onSearch((query, results) => {
						// If query is blank, just show the current icon
						if (!query && this.icon) {
							const [name] = ICONS.get(this.icon) ?? [this.icon];
							void this.resultsSetting.setResults([[this.icon, name, [], 0]]);
							return;
						}
						void this.resultsSetting.setResults(results);
					})
					.then((component) => (this.searchField = component)),
			);
		if (!Platform.isPhone) bindLocalizedControl(this.searchSetting.setName(t('iconic.iconPicker.search')), "name", "iconic.iconPicker.search");

		// SETTING: Search results
		this.resultsSetting = new IconSearchResultsSetting(this.contentEl)
			.setLimit(this.plugin.settings.maxSearchResults)
			.setColor(this.color ?? null)
			.forEach((iconButton, [id, name, keywords]) => {
				const tooltip = name + '\n' + keywords.slice(0, 3).join(' • ');
				iconButton
					.onClick(() => this.closeAndSave(id, this.color))
					.setTooltip(tooltip, {
						delay: 300,
						placement: Platform.isMobile ? 'top' : undefined,
						classes: ['iconic-search-tooltip'],
					});
				// Set long-touch tooltips on mobile
				if (Platform.isMobile) {
					iconButton.onSecondaryClick(() => {
						navigator.vibrate?.(100); // Not supported on iOS
						iconButton.displayTooltip(tooltip, {
							placement: 'top',
							classes: ['iconic-search-tooltip'],
						});
					});
				}
			});

		// Auto-select the most useful mode
		if (this.icon) {
			if (ICONS.has(this.icon)) {
				dialogState.iconMode = true;
				this.searchField.setValue(ICONS.get(this.icon)?.[0] ?? '');
			} else if (EMOJIS.has(this.icon)) {
				dialogState.emojiMode = true;
				this.searchField.setValue(EMOJIS.get(this.icon)?.[0] ?? '');
			} else {
				this.searchField.setValue(this.icon);
			}
		} else if (!dialogState.iconMode && !dialogState.emojiMode) {
			dialogState.iconMode = true;
		}
		this.searchField.setModes({
			iconMode: dialogState.iconMode,
			emojiMode: dialogState.emojiMode,
			keywordMode: this.plugin.isSettingEnabled('useSearchKeywords'),
		});

		// Match styling of bookmark edit dialog
		const buttonContainerEl = this.modalEl.createDiv({ cls: 'modal-button-container' });
		const removeContainerEl = Platform.isMobile
			? buttonContainerEl.createDiv({ cls: 'iconic-button-row' })
			: buttonContainerEl;
		const saveContainerEl = Platform.isPhone ? this.modalEl : buttonContainerEl;

		// BUTTON: Remove
		if (this.icon || this.color) {
			const removeEl = bindLocalizedControl(new ButtonComponent(removeContainerEl)
				.setButtonText(
					this.items.length === 1
						? t('iconic.menu.removeIcon')
						: t('iconic.menu.removeIcons').replace('{#}', this.items.length.toString()),
				), "buttonText", this.items.length === 1 ? ("iconic.menu.removeIcon") : ("iconic.menu.removeIcons"), (this.items.length === 1) ? (undefined) : ({"#": this.items.length.toString()}))
				.onClick(() => this.closeAndSave(null, null)).buttonEl;
			removeEl.addClasses(Platform.isPhone ? ['mod-warning'] : ['mod-secondary', 'mod-destructive']);
		}

		// BUTTON: Toggle icons
		bindLocalizedControl(new ToggleButtonComponent(removeContainerEl)
			.setValue(dialogState.iconMode)
			.setTooltip(t('iconic.iconPicker.toggleIcons'), { delay: 300, placement: 'top' }), "tooltip", "iconic.iconPicker.toggleIcons")
			.setIcons('lucide-image', 'lucide-square')
			.setClass('iconic-mode-button')
			.onChange((on) => {
				dialogState.iconMode = on;
				this.updateTitle();
				this.searchField.setModes({ iconMode: on });
			});

		// BUTTON: Toggle emojis
		bindLocalizedControl(new ToggleButtonComponent(removeContainerEl)
			.setValue(dialogState.emojiMode)
			.setTooltip(t('iconic.iconPicker.toggleEmojis'), { delay: 300, placement: 'top' }), "tooltip", "iconic.iconPicker.toggleEmojis")
			.setIcons('lucide-smile', 'lucide-circle')
			.setClass('iconic-mode-button')
			.onChange((on) => {
				dialogState.emojiMode = on;
				this.updateTitle();
				this.searchField.setModes({ emojiMode: on });
			});

		// BUTTON: Cancel
		bindLocalizedControl(new ButtonComponent(saveContainerEl)
			.setButtonText(t('iconic.iconPicker.cancel')), "buttonText", "iconic.iconPicker.cancel")
			.onClick(() => this.close())
			.buttonEl.addClasses(Platform.isPhone ? ['modal-nav-action', 'mod-secondary'] : ['mod-cancel']);

		// BUTTON: Save
		const saveEl = bindLocalizedControl(new ButtonComponent(saveContainerEl)
			.setButtonText(t('iconic.iconPicker.save')), "buttonText", "iconic.iconPicker.save")
			.onClick(() => this.closeAndSave(this.icon, this.color)).buttonEl;
		saveEl.addClasses(Platform.isPhone ? ['modal-nav-action', 'mod-cta'] : ['mod-cta']);

		// Hack to guarantee initial focus
		this.modalEl.win.requestAnimationFrame(() => this.searchField.inputEl.select());
	}

	private updateTitle(): void {
		const { dialogState } = this.plugin.settings;
		const isSingular = this.items.length === 1;

		if (dialogState.iconMode && dialogState.emojiMode) {
			bindLocalizedControl(this.setTitle(
				isSingular
					? t('iconic.iconPicker.changeMix')
					: t('iconic.iconPicker.changeMixes').replace('{#}', this.items.length.toString()),
			), "title", isSingular ? ("iconic.iconPicker.changeMix") : ("iconic.iconPicker.changeMixes"), (isSingular) ? (undefined) : ({"#": this.items.length.toString()}));
		} else if (dialogState.emojiMode) {
			bindLocalizedControl(this.setTitle(
				isSingular
					? t('iconic.iconPicker.changeEmoji')
					: t('iconic.iconPicker.changeEmojis').replace('{#}', this.items.length.toString()),
			), "title", isSingular ? ("iconic.iconPicker.changeEmoji") : ("iconic.iconPicker.changeEmojis"), (isSingular) ? (undefined) : ({"#": this.items.length.toString()}));
		} else {
			bindLocalizedControl(this.setTitle(
				isSingular
					? t('iconic.iconPicker.changeIcon')
					: t('iconic.iconPicker.changeIcons').replace('{#}', this.items.length.toString()),
			), "title", isSingular ? ("iconic.iconPicker.changeIcon") : ("iconic.iconPicker.changeIcons"), (isSingular) ? (undefined) : ({"#": this.items.length.toString()}));
			bindLocalizedControl(this.searchField.setPlaceholder(t('iconic.iconPicker.searchIcons')), "placeholder", "iconic.iconPicker.searchIcons");
		}
	}

	/**
	 * Display a callout if this icon is currently overruled.
	 */
	private updateOverruleCallout(): void {
		let page: Category;
		let rule: RuleItem | null = null;

		// Determine which rule to display
		if (this.items.length > 1) {
			for (const item of this.items) {
				rule = this.plugin.ruleManager?.checkRuling(item.category, item.id) ?? null;
				page = item.category;
				if (rule) break;
			}
		} else {
			const item = this.items.first();
			if (item) {
				rule = this.plugin.ruleManager?.checkRuling(item.category, item.id) ?? null;
				page = item.category;
			}
		}

		// Hide callout if nothing is overruling this icon
		if (rule) {
			this.overruleCallout.setVisibility(true);
		} else {
			this.overruleCallout.setVisibility(false);
			return;
		}

		// If multiple items are being edited, display a non-specific message
		if (this.items.length > 1) {
			bindLocalizedControl(this.overruleCallout.setIcon('lucide-book-image').setColor(null).setTitle(t('iconic.iconPicker.overrules')), "title", "iconic.iconPicker.overrules");
			// Else, display a clickable link to the specific rule
		} else {
			this.overruleCallout.setIcon(rule.icon).setColor(rule.color);
			const titleFrag = new DocumentFragment();
			titleFrag.appendText(t('iconic.iconPicker.overrulePrefix'));
			titleFrag.createEl('a', { text: rule.name }).addEventListener('click', () => {
				this.plugin.openRuleEditor(page, rule, (newRule) => {
					const isRulingChanged = newRule
						? this.plugin.ruleManager?.saveRule(page, newRule)
						: this.plugin.ruleManager?.deleteRule(page, rule.id);
					if (isRulingChanged) this.plugin.refreshManagers(page);
					this.updateOverruleCallout();
				});
			});
			titleFrag.appendText(t('iconic.iconPicker.overruleSuffix'));
			this.overruleCallout.setTitle(titleFrag);
		}
	}

	/**
	 * Close dialog while passing icon & color to original callback.
	 */
	private closeAndSave(icon: string | null | undefined, color: string | null | undefined): void {
		if (this.callback) {
			this.callback(icon ?? null, color ?? null);
		} else if (this.multiCallback) {
			this.multiCallback(icon, color);
		}
		this.close();
	}

	/**
	 * @override
	 */
	onClose(): void {
		this.plugin.forgetDialog(this);
		this.contentEl.empty();
		void this.plugin.saveSettings(); // Save any changes to dialogState
	}
}
