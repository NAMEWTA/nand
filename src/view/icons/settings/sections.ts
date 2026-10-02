import { bindLocalizedOptions } from '../../primitives/localized-dom';
import { bindLocalizedControl } from '../../primitives/localized-dom';
import { ExtraButtonComponent, Platform, requireApiVersion, SettingDefinitionGroup, SettingGroup } from 'obsidian';
import type { FileItem } from '../../../core/icons/types';
import type IconicController from '../../../platform/obsidian/icons/host/controller';
import { internalApp } from '../../../platform/obsidian/icons/utils/obsidian-internal';
import { STRINGS } from '../../../shared/i18n/icons-accessor';
import RulePicker from '../dialogs/rule-picker';
import UsageChecker from '../dialogs/usage-checker';

/**
 * Exposes UI settings for the plugin.
 */
export class IconicSettingsSections {
	private readonly plugin: IconicController;
	private containerEl!: HTMLElement;
	get app(): IconicController['app'] {
		return this.plugin.app;
	}
	private section(page: string): HTMLElement {
		const el = this.containerEl.createDiv();
		el.dataset.settingsProduct = 'iconic';
		el.dataset.settingsPage = page;
		return el;
	}

	// Components
	private biggerIconsIndicator?: ExtraButtonComponent;
	private showItemNameIndicator?: ExtraButtonComponent;
	private clickableIconsIndicator?: ExtraButtonComponent;
	private useSearchKeywordsIndicator?: ExtraButtonComponent;
	private colorPickerIndicator1?: ExtraButtonComponent;
	private colorPickerIndicator2?: ExtraButtonComponent;

	constructor(plugin: IconicController) {
		this.plugin = plugin;
	}

	/**
	 * @override
	 */
	getSettingDefinitions(): SettingDefinitionGroup[] {
		if (requireApiVersion('1.13.0')) {
			// GROUP: Top
			const groupTop: SettingDefinitionGroup = { type: 'group', items: [] };

			// SETTING: Rules
			groupTop.items?.push({
				name: STRINGS.settings.rulebook.name,
				desc: STRINGS.settings.rulebook.desc,
				render: (setting) => {
					setting.addButton((button) => {
						bindLocalizedControl(button.setButtonText(STRINGS.settings.manage), "buttonText", "iconic.settings.manage").onClick(() => {
							// Silently no-op if rulebook hasn't finished loading
							if (!this.plugin.ruleManager) return;

							internalApp(this.app).setting.close();
							RulePicker.open(this.plugin);
						});
					});
				},
			});

			// SETTING: Bigger icons
			groupTop.items?.push({
				name: STRINGS.settings.biggerIcons.name,
				desc: STRINGS.settings.biggerIcons.desc,
				render: (setting) => {
					setting
						.addExtraButton((indicator) => {
							indicator.extraSettingsEl.addClass('iconic-indicator');
							this.biggerIconsIndicator = indicator;
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									on: STRINGS.settings.values.on,
									desktop: STRINGS.settings.values.desktop,
									mobile: STRINGS.settings.values.mobile,
									off: STRINGS.settings.values.off,
								}), {on: ["iconic.settings.values.on"], desktop: ["iconic.settings.values.desktop"], mobile: ["iconic.settings.values.mobile"], off: ["iconic.settings.values.off"]})
								.setValue(this.plugin.settings.biggerIcons)
								.onChange((value) => {
									this.refreshIndicator(this.biggerIconsIndicator, value);
									this.plugin.settings.biggerIcons = value;
									void this.plugin.saveSettings();
									this.plugin.refreshBody();
								});
							this.refreshIndicator(this.biggerIconsIndicator, dropdown.getValue());
						});
				},
			});

			// SETTING: Clickable icons
			groupTop.items?.push({
				name: Platform.isDesktop
					? STRINGS.settings.clickableIcons.nameDesktop
					: STRINGS.settings.clickableIcons.nameMobile,
				desc: Platform.isDesktop
					? STRINGS.settings.clickableIcons.descDesktop
					: STRINGS.settings.clickableIcons.descMobile,
				render: (setting) => {
					setting
						.addExtraButton((indicator) => {
							indicator.extraSettingsEl.addClass('iconic-indicator');
							this.clickableIconsIndicator = indicator;
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									on: STRINGS.settings.values.on,
									desktop: STRINGS.settings.values.desktop,
									mobile: STRINGS.settings.values.mobile,
									off: STRINGS.settings.values.off,
								}), {on: ["iconic.settings.values.on"], desktop: ["iconic.settings.values.desktop"], mobile: ["iconic.settings.values.mobile"], off: ["iconic.settings.values.off"]})
								.setValue(this.plugin.settings.clickableIcons)
								.onChange((value) => {
									this.refreshIndicator(this.clickableIconsIndicator, value);
									this.plugin.settings.clickableIcons = value;
									void this.plugin.saveSettings();
									this.plugin.refreshManagers();
									this.plugin.refreshBody();
								});
							this.refreshIndicator(this.clickableIconsIndicator, dropdown.getValue());
						});
				},
			});

			// GROUP: Sidebars & tabs
			const groupSidebarsAndTabs: SettingDefinitionGroup = {
				type: 'group',
				heading: STRINGS.settings.headingSidebarsAndTabs,
				items: [],
			};

			// SETTING: Show all file icons
			groupSidebarsAndTabs.items?.push({
				name: STRINGS.settings.showAllFileIcons.name,
				desc: STRINGS.settings.showAllFileIcons.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.showAllFileIcons).onChange((value) => {
							this.plugin.settings.showAllFileIcons = value;
							void this.plugin.saveSettings();
							this.plugin.refreshManagers('file');
						});
					});
				},
			});

			groupSidebarsAndTabs.items?.push({
				name: STRINGS.settings.showAllFolderIcons.name,
				desc: STRINGS.settings.showAllFolderIcons.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.showAllFolderIcons).onChange((value) => {
							this.plugin.settings.showAllFolderIcons = value;
							void this.plugin.saveSettings();
							this.plugin.refreshManagers('folder');
						});
					});
				},
			});

			// SETTING: Minimal folder icons
			groupSidebarsAndTabs.items?.push({
				name: STRINGS.settings.minimalFolderIcons.name,
				desc: STRINGS.settings.minimalFolderIcons.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.minimalFolderIcons).onChange((value) => {
							this.plugin.settings.minimalFolderIcons = value;
							void this.plugin.saveSettings();
							this.plugin.refreshManagers('folder');
						});
					});
				},
			});

			// SETTING: Show Markdown tab icons
			groupSidebarsAndTabs.items?.push({
				name: STRINGS.settings.showMarkdownTabIcons.name,
				desc: STRINGS.settings.showMarkdownTabIcons.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.showMarkdownTabIcons).onChange((value) => {
							this.plugin.settings.showMarkdownTabIcons = value;
							void this.plugin.saveSettings();
							this.plugin.refreshBody();
						});
					});
				},
			});

			// GROUP: Editor
			const groupEditor: SettingDefinitionGroup = {
				type: 'group',
				heading: STRINGS.settings.headingEditor,
				items: [],
			};

			// SETTING: Show title icons
			groupEditor.items?.push({
				name: STRINGS.settings.showTitleIcons.name,
				desc: STRINGS.settings.showTitleIcons.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.showTitleIcons).onChange((value) => {
							this.plugin.settings.showTitleIcons = value;
							void this.plugin.saveSettings();
							this.plugin.refreshManagers('file');
						});
					});
				},
			});

			// SETTING: Show tag pill icons
			groupEditor.items?.push({
				name: STRINGS.settings.showTagPillIcons.name,
				desc: STRINGS.settings.showTagPillIcons.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.showTagPillIcons).onChange((value) => {
							this.plugin.settings.showTagPillIcons = value;
							void this.plugin.saveSettings();
							this.plugin.refreshManagers('tag');
						});
					});
				},
			});

			// GROUP: Menus & dialogs
			const groupMenusAndDialogs: SettingDefinitionGroup = {
				type: 'group',
				heading: STRINGS.settings.headingMenusAndDialogs,
				items: [],
			};

			// SETTING: Show menu actions
			groupMenusAndDialogs.items?.push({
				name: STRINGS.settings.showMenuActions.name,
				desc: STRINGS.settings.showMenuActions.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.showMenuActions).onChange((value) => {
							this.plugin.settings.showMenuActions = value;
							void this.plugin.saveSettings();
							this.plugin.refreshManagers();
						});
					});
				},
			});

			// SETTING: Show suggestion icons
			groupMenusAndDialogs.items?.push({
				name: STRINGS.settings.showSuggestionIcons.name,
				desc: STRINGS.settings.showSuggestionIcons.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.showSuggestionIcons).onChange((value) => {
							this.plugin.settings.showSuggestionIcons = value;
							void this.plugin.saveSettings();
						});
					});
				},
			});

			// SETTING: Show quick switcher icons
			groupMenusAndDialogs.items?.push({
				name: STRINGS.settings.showQuickSwitcherIcons.name,
				desc: STRINGS.settings.showQuickSwitcherIcons.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.showQuickSwitcherIcons).onChange((value) => {
							this.plugin.settings.showQuickSwitcherIcons = value;
							void this.plugin.saveSettings();
						});
					});
				},
			});

			// SETTING: Show “Move file” dialog icons
			groupMenusAndDialogs.items?.push({
				name: STRINGS.settings.showMoveFileIcons.name,
				desc: STRINGS.settings.showMoveFileIcons.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.showMoveFileIcons).onChange((value) => {
							this.plugin.settings.showMoveFileIcons = value;
							void this.plugin.saveSettings();
						});
					});
				},
			});

			// GROUP: Icon picker
			const groupIconPicker: SettingDefinitionGroup = {
				type: 'group',
				heading: STRINGS.settings.headingIconPicker,
				items: [],
			};

			// SETTING: Show item name
			groupIconPicker.items?.push({
				name: STRINGS.settings.showItemName.name,
				desc: STRINGS.settings.showItemName.desc,
				render: (setting) => {
					setting
						.addExtraButton((indicator) => {
							indicator.extraSettingsEl.addClass('iconic-indicator');
							this.showItemNameIndicator = indicator;
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									on: STRINGS.settings.values.on,
									desktop: STRINGS.settings.values.desktop,
									mobile: STRINGS.settings.values.mobile,
									off: STRINGS.settings.values.off,
								}), {on: ["iconic.settings.values.on"], desktop: ["iconic.settings.values.desktop"], mobile: ["iconic.settings.values.mobile"], off: ["iconic.settings.values.off"]})
								.setValue(this.plugin.settings.showItemName)
								.onChange((value) => {
									this.refreshIndicator(this.showItemNameIndicator, value);
									this.plugin.settings.showItemName = value;
									void this.plugin.saveSettings();
								});
							this.refreshIndicator(this.showItemNameIndicator, dropdown.getValue());
						});
				},
			});

			// SETTING: Use search keywords
			groupIconPicker.items?.push({
				name: STRINGS.settings.useSearchKeywords.name,
				desc: STRINGS.settings.useSearchKeywords.desc,
				render: (setting) => {
					setting
						.addExtraButton((indicator) => {
							indicator.extraSettingsEl.addClass('iconic-indicator');
							this.useSearchKeywordsIndicator = indicator;
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									on: STRINGS.settings.values.on,
									desktop: STRINGS.settings.values.desktop,
									mobile: STRINGS.settings.values.mobile,
									off: STRINGS.settings.values.off,
								}), {on: ["iconic.settings.values.on"], desktop: ["iconic.settings.values.desktop"], mobile: ["iconic.settings.values.mobile"], off: ["iconic.settings.values.off"]})
								.setValue(this.plugin.settings.useSearchKeywords)
								.onChange((value) => {
									this.refreshIndicator(this.useSearchKeywordsIndicator, value);
									this.plugin.settings.useSearchKeywords = value;
									void this.plugin.saveSettings();
									this.plugin.refreshBody();
								});
							this.refreshIndicator(this.useSearchKeywordsIndicator, dropdown.getValue());
						});
				},
			});

			// SETTING: Maximum search results
			groupIconPicker.items?.push({
				name: STRINGS.settings.maxSearchResults.name,
				desc: STRINGS.settings.maxSearchResults.desc,
				render: (setting) => {
					setting.addSlider((slider) => {
						slider
							.setLimits(50, 300, 10)
							.setValue(this.plugin.settings.maxSearchResults)
							.onChange((value) => {
								this.plugin.settings.maxSearchResults = value;
								void this.plugin.saveSettings();
							});
					});
				},
			});

			// SETTING: Main color picker
			groupIconPicker.items?.push({
				name: STRINGS.settings.colorPicker1.name,
				desc: Platform.isDesktop
					? STRINGS.settings.colorPicker1.descDesktop
					: STRINGS.settings.colorPicker1.descMobile,
				render: (setting) => {
					setting
						.addExtraButton((indicator) => {
							indicator.extraSettingsEl.addClass('iconic-indicator');
							this.colorPickerIndicator1 = indicator;
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									list: STRINGS.settings.values.list,
									rgb: STRINGS.settings.values.rgb,
								}), {list: ["iconic.settings.values.list"], rgb: ["iconic.settings.values.rgb"]})
								.setValue(this.plugin.settings.colorPicker1)
								.onChange((value) => {
									this.refreshIndicator(this.colorPickerIndicator1, value);
									this.plugin.settings.colorPicker1 = value;
									void this.plugin.saveSettings();
								});
							this.refreshIndicator(this.colorPickerIndicator1, dropdown.getValue());
						});
				},
			});

			// SETTING: Second color picker
			groupIconPicker.items?.push({
				name: STRINGS.settings.colorPicker2.name,
				desc: Platform.isDesktop
					? STRINGS.settings.colorPicker2.descDesktop
					: STRINGS.settings.colorPicker2.descMobile,
				render: (setting) => {
					setting
						.addExtraButton((indicator) => {
							indicator.extraSettingsEl.addClass('iconic-indicator');
							this.colorPickerIndicator2 = indicator;
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									list: STRINGS.settings.values.list,
									rgb: STRINGS.settings.values.rgb,
								}), {list: ["iconic.settings.values.list"], rgb: ["iconic.settings.values.rgb"]})
								.setValue(this.plugin.settings.colorPicker2)
								.onChange((value) => {
									this.refreshIndicator(this.colorPickerIndicator2, value);
									this.plugin.settings.colorPicker2 = value;
									void this.plugin.saveSettings();
								});
							this.refreshIndicator(this.colorPickerIndicator2, dropdown.getValue());
						});
				},
			});

			// GROUP: Advanced
			const groupAdvanced: SettingDefinitionGroup = {
				type: 'group',
				heading: STRINGS.settings.headingAdvanced,
				items: [],
			};

			// SETTING: Colorless hover
			groupAdvanced.items?.push({
				name: STRINGS.settings.uncolorHover.name,
				desc: STRINGS.settings.uncolorHover.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.uncolorHover).onChange((value) => {
							this.plugin.settings.uncolorHover = value;
							void this.plugin.saveSettings();
							this.plugin.refreshBody();
						});
					});
				},
			});

			// SETTING: Colorless drag
			groupAdvanced.items?.push({
				name: STRINGS.settings.uncolorDrag.name,
				desc: STRINGS.settings.uncolorDrag.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.uncolorDrag).onChange((value) => {
							this.plugin.settings.uncolorDrag = value;
							void this.plugin.saveSettings();
							this.plugin.refreshBody();
						});
					});
				},
			});

			// SETTING: Colorless selection
			groupAdvanced.items?.push({
				name: STRINGS.settings.uncolorSelect.name,
				desc: STRINGS.settings.uncolorSelect.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.uncolorSelect).onChange((value) => {
							this.plugin.settings.uncolorSelect = value;
							void this.plugin.saveSettings();
							this.plugin.refreshBody();
						});
					});
				},
			});

			// SETTING: Colorless ribbon button
			groupAdvanced.items?.push({
				name: STRINGS.settings.uncolorQuick.name,
				desc: STRINGS.settings.uncolorQuick.desc,
				render: (setting) => {
					setting.addToggle((toggle) => {
						toggle.setValue(this.plugin.settings.uncolorQuick).onChange((value) => {
							this.plugin.settings.uncolorQuick = value;
							void this.plugin.saveSettings();
							this.plugin.refreshManagers('ribbon');
						});
					});
				},
			});

			// SETTING: View unused icons
			groupAdvanced.items?.push({
				name: STRINGS.settings.viewUnusedIcons.name,
				desc: STRINGS.settings.viewUnusedIcons.desc,
				render: (setting) => {
					setting.addButton((button) => {
						bindLocalizedControl(button.setButtonText(STRINGS.settings.manage), "buttonText", "iconic.settings.manage").onClick(async () => {
							const unusedIcons: FileItem[] = [];
							for (const fileId of Object.keys(this.plugin.settings.fileIcons)) {
								if (!(await this.app.vault.adapter.exists(fileId))) {
									const file = this.plugin.getFileItem(fileId);
									unusedIcons.push(file);
								}
							}
							UsageChecker.open(this.plugin, unusedIcons);
						});
					});
				},
			});

			// SETTING: Maximum automatic backups
			groupAdvanced.items?.push({
				name: STRINGS.settings.maxBackups.name,
				desc: STRINGS.settings.maxBackups.desc,
				render: (setting) => {
					setting
						.then((setting) => {
							if (Platform.isDesktop)
								setting.addExtraButton((button) => {
									bindLocalizedControl(button
										.setIcon('lucide-folder-open')
										.setTooltip(STRINGS.settings.maxBackups.openPluginFolder), "tooltip", "iconic.settings.maxBackups.openPluginFolder")
										.onClick(() => {
											internalApp(this.app).openWithDefaultApp(this.plugin.manifest.dir ?? '');
										});
								});
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									0: STRINGS.settings.values.none,
									1: '1',
									2: '2',
									3: '3',
									4: '4',
									5: '5',
									6: '6',
									7: '7',
									8: '8',
									9: '9',
								}), {0: ["iconic.settings.values.none"]})
								.setValue(this.plugin.settings.maxBackups.toString())
								.onChange((value) => {
									this.plugin.settings.maxBackups = Number(value) || 0;
									void this.plugin.saveSettings();
								});
						});
				},
			});

			return [groupTop, groupSidebarsAndTabs, groupEditor, groupMenusAndDialogs, groupIconPicker, groupAdvanced];
		}
		return [];
	}

	renderFallback(containerEl: HTMLElement): void {
		this.containerEl = containerEl;
		this.containerEl.empty();

		// GROUP: Top
		const groupTop = new SettingGroup(this.section('iconic-general'));

		// SETTING: Rulebook
		groupTop.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.rulebook.name), "name", "iconic.settings.rulebook.name")
				.setDesc(STRINGS.settings.rulebook.desc), "desc", "iconic.settings.rulebook.desc")
				.addButton((button) => {
					bindLocalizedControl(button.setButtonText(STRINGS.settings.manage), "buttonText", "iconic.settings.manage").onClick(() => {
						// Silently no-op if rulebook hasn't finished loading
						if (!this.plugin.ruleManager) return;

						internalApp(this.app).setting.close();
						RulePicker.open(this.plugin);
					});
				});
		});

		// SETTING: Bigger icons
		groupTop.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.biggerIcons.name), "name", "iconic.settings.biggerIcons.name")
				.setDesc(STRINGS.settings.biggerIcons.desc), "desc", "iconic.settings.biggerIcons.desc")
				.addExtraButton((indicator) => {
					indicator.extraSettingsEl.addClass('iconic-indicator');
					this.biggerIconsIndicator = indicator;
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							on: STRINGS.settings.values.on,
							desktop: STRINGS.settings.values.desktop,
							mobile: STRINGS.settings.values.mobile,
							off: STRINGS.settings.values.off,
						}), {on: ["iconic.settings.values.on"], desktop: ["iconic.settings.values.desktop"], mobile: ["iconic.settings.values.mobile"], off: ["iconic.settings.values.off"]})
						.setValue(this.plugin.settings.biggerIcons)
						.onChange((value) => {
							this.refreshIndicator(this.biggerIconsIndicator, value);
							this.plugin.settings.biggerIcons = value;
							void this.plugin.saveSettings();
							this.plugin.refreshBody();
						});
					this.refreshIndicator(this.biggerIconsIndicator, dropdown.getValue());
				});
		});

		// SETTING: Clickable icons
		groupTop.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(
					Platform.isDesktop
						? STRINGS.settings.clickableIcons.nameDesktop
						: STRINGS.settings.clickableIcons.nameMobile,
				), "name", Platform.isDesktop ? ("iconic.settings.clickableIcons.nameDesktop") : ("iconic.settings.clickableIcons.nameMobile"), (Platform.isDesktop) ? (undefined) : (undefined))
				.setDesc(
					Platform.isDesktop
						? STRINGS.settings.clickableIcons.descDesktop
						: STRINGS.settings.clickableIcons.descMobile,
				), "desc", Platform.isDesktop ? ("iconic.settings.clickableIcons.descDesktop") : ("iconic.settings.clickableIcons.descMobile"), (Platform.isDesktop) ? (undefined) : (undefined))
				.addExtraButton((indicator) => {
					indicator.extraSettingsEl.addClass('iconic-indicator');
					this.clickableIconsIndicator = indicator;
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							on: STRINGS.settings.values.on,
							desktop: STRINGS.settings.values.desktop,
							mobile: STRINGS.settings.values.mobile,
							off: STRINGS.settings.values.off,
						}), {on: ["iconic.settings.values.on"], desktop: ["iconic.settings.values.desktop"], mobile: ["iconic.settings.values.mobile"], off: ["iconic.settings.values.off"]})
						.setValue(this.plugin.settings.clickableIcons)
						.onChange((value) => {
							this.refreshIndicator(this.clickableIconsIndicator, value);
							this.plugin.settings.clickableIcons = value;
							void this.plugin.saveSettings();
							this.plugin.refreshManagers();
							this.plugin.refreshBody();
						});
					this.refreshIndicator(this.clickableIconsIndicator, dropdown.getValue());
				});
		});

		// GROUP: Sidebars & tabs
		const groupSidebarsAndTabs = new SettingGroup(this.section('iconic-sidebars')).setHeading(
			STRINGS.settings.headingSidebarsAndTabs,
		);

		// SETTING: Show all file icons
		groupSidebarsAndTabs.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.showAllFileIcons.name), "name", "iconic.settings.showAllFileIcons.name")
				.setDesc(STRINGS.settings.showAllFileIcons.desc), "desc", "iconic.settings.showAllFileIcons.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.showAllFileIcons).onChange((value) => {
						this.plugin.settings.showAllFileIcons = value;
						void this.plugin.saveSettings();
						this.plugin.refreshManagers('file');
					});
				});
		});

		// SETTING: Show all folder icons
		groupSidebarsAndTabs.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.showAllFolderIcons.name), "name", "iconic.settings.showAllFolderIcons.name")
				.setDesc(STRINGS.settings.showAllFolderIcons.desc), "desc", "iconic.settings.showAllFolderIcons.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.showAllFolderIcons).onChange((value) => {
						this.plugin.settings.showAllFolderIcons = value;
						void this.plugin.saveSettings();
						this.plugin.refreshManagers('folder');
					});
				});
		});

		// SETTING: Minimal folder icons
		groupSidebarsAndTabs.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.minimalFolderIcons.name), "name", "iconic.settings.minimalFolderIcons.name")
				.setDesc(STRINGS.settings.minimalFolderIcons.desc), "desc", "iconic.settings.minimalFolderIcons.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.minimalFolderIcons).onChange((value) => {
						this.plugin.settings.minimalFolderIcons = value;
						void this.plugin.saveSettings();
						this.plugin.refreshManagers('folder');
					});
				});
		});

		// SETTING: Show Markdown tab icons
		groupSidebarsAndTabs.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.showMarkdownTabIcons.name), "name", "iconic.settings.showMarkdownTabIcons.name")
				.setDesc(STRINGS.settings.showMarkdownTabIcons.desc), "desc", "iconic.settings.showMarkdownTabIcons.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.showMarkdownTabIcons).onChange((value) => {
						this.plugin.settings.showMarkdownTabIcons = value;
						void this.plugin.saveSettings();
						this.plugin.refreshBody();
					});
				});
		});

		// GROUP: Editor
		const groupEditor = new SettingGroup(this.section('iconic-editor')).setHeading(STRINGS.settings.headingEditor);

		// SETTING: Show title icons
		groupEditor.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.showTitleIcons.name), "name", "iconic.settings.showTitleIcons.name")
				.setDesc(STRINGS.settings.showTitleIcons.desc), "desc", "iconic.settings.showTitleIcons.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.showTitleIcons).onChange((value) => {
						this.plugin.settings.showTitleIcons = value;
						void this.plugin.saveSettings();
						this.plugin.refreshManagers('file');
					});
				});
		});

		// SETTING: Show tag pill icons
		groupEditor.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.showTagPillIcons.name), "name", "iconic.settings.showTagPillIcons.name")
				.setDesc(STRINGS.settings.showTagPillIcons.desc), "desc", "iconic.settings.showTagPillIcons.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.showTagPillIcons).onChange((value) => {
						this.plugin.settings.showTagPillIcons = value;
						void this.plugin.saveSettings();
						this.plugin.refreshManagers('tag');
					});
				});
		});

		// GROUP: Menus & dialogs
		const groupMenusAndDialogs = new SettingGroup(this.section('iconic-menus')).setHeading(
			STRINGS.settings.headingMenusAndDialogs,
		);

		// SETTING: Show menu actions
		groupMenusAndDialogs.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.showMenuActions.name), "name", "iconic.settings.showMenuActions.name")
				.setDesc(STRINGS.settings.showMenuActions.desc), "desc", "iconic.settings.showMenuActions.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.showMenuActions).onChange((value) => {
						this.plugin.settings.showMenuActions = value;
						void this.plugin.saveSettings();
						this.plugin.refreshManagers();
					});
				});
		});

		// SETTING: Show suggestion icons
		groupMenusAndDialogs.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.showSuggestionIcons.name), "name", "iconic.settings.showSuggestionIcons.name")
				.setDesc(STRINGS.settings.showSuggestionIcons.desc), "desc", "iconic.settings.showSuggestionIcons.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.showSuggestionIcons).onChange((value) => {
						this.plugin.settings.showSuggestionIcons = value;
						void this.plugin.saveSettings();
					});
				});
		});

		// SETTING: Show quick switcher icons
		groupMenusAndDialogs.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.showQuickSwitcherIcons.name), "name", "iconic.settings.showQuickSwitcherIcons.name")
				.setDesc(STRINGS.settings.showQuickSwitcherIcons.desc), "desc", "iconic.settings.showQuickSwitcherIcons.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.showQuickSwitcherIcons).onChange((value) => {
						this.plugin.settings.showQuickSwitcherIcons = value;
						void this.plugin.saveSettings();
					});
				});
		});

		// SETTING: Show “Move file” dialog icons
		groupMenusAndDialogs.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.showMoveFileIcons.name), "name", "iconic.settings.showMoveFileIcons.name")
				.setDesc(STRINGS.settings.showMoveFileIcons.desc), "desc", "iconic.settings.showMoveFileIcons.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.showMoveFileIcons).onChange((value) => {
						this.plugin.settings.showMoveFileIcons = value;
						void this.plugin.saveSettings();
					});
				});
		});

		// GROUP: Icon picker
		const groupIconPicker = new SettingGroup(this.section('iconic-picker')).setHeading(
			STRINGS.settings.headingIconPicker,
		);

		// SETTING: Show item name
		groupIconPicker.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.showItemName.name), "name", "iconic.settings.showItemName.name")
				.setDesc(STRINGS.settings.showItemName.desc), "desc", "iconic.settings.showItemName.desc")
				.addExtraButton((indicator) => {
					indicator.extraSettingsEl.addClass('iconic-indicator');
					this.showItemNameIndicator = indicator;
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							on: STRINGS.settings.values.on,
							desktop: STRINGS.settings.values.desktop,
							mobile: STRINGS.settings.values.mobile,
							off: STRINGS.settings.values.off,
						}), {on: ["iconic.settings.values.on"], desktop: ["iconic.settings.values.desktop"], mobile: ["iconic.settings.values.mobile"], off: ["iconic.settings.values.off"]})
						.setValue(this.plugin.settings.showItemName)
						.onChange((value) => {
							this.refreshIndicator(this.showItemNameIndicator, value);
							this.plugin.settings.showItemName = value;
							void this.plugin.saveSettings();
						});
					this.refreshIndicator(this.showItemNameIndicator, dropdown.getValue());
				});
		});

		// SETTING: Use search keywords
		groupIconPicker.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.useSearchKeywords.name), "name", "iconic.settings.useSearchKeywords.name")
				.setDesc(STRINGS.settings.useSearchKeywords.desc), "desc", "iconic.settings.useSearchKeywords.desc")
				.addExtraButton((indicator) => {
					indicator.extraSettingsEl.addClass('iconic-indicator');
					this.useSearchKeywordsIndicator = indicator;
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							on: STRINGS.settings.values.on,
							desktop: STRINGS.settings.values.desktop,
							mobile: STRINGS.settings.values.mobile,
							off: STRINGS.settings.values.off,
						}), {on: ["iconic.settings.values.on"], desktop: ["iconic.settings.values.desktop"], mobile: ["iconic.settings.values.mobile"], off: ["iconic.settings.values.off"]})
						.setValue(this.plugin.settings.useSearchKeywords)
						.onChange((value) => {
							this.refreshIndicator(this.useSearchKeywordsIndicator, value);
							this.plugin.settings.useSearchKeywords = value;
							void this.plugin.saveSettings();
							this.plugin.refreshBody();
						});
					this.refreshIndicator(this.useSearchKeywordsIndicator, dropdown.getValue());
				});
		});

		// SETTING: Maximum search results
		groupIconPicker.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.maxSearchResults.name), "name", "iconic.settings.maxSearchResults.name")
				.setDesc(STRINGS.settings.maxSearchResults.desc), "desc", "iconic.settings.maxSearchResults.desc")
				.addSlider((slider) => {
					slider
						.setLimits(50, 500, 10)
						.setValue(this.plugin.settings.maxSearchResults)
						.onChange((value) => {
							this.plugin.settings.maxSearchResults = value;
							void this.plugin.saveSettings();
						});
				});
		});

		// SETTING: Main color picker
		groupIconPicker.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.colorPicker1.name), "name", "iconic.settings.colorPicker1.name")
				.setDesc(
					Platform.isDesktop
						? STRINGS.settings.colorPicker1.descDesktop
						: STRINGS.settings.colorPicker1.descMobile,
				), "desc", Platform.isDesktop ? ("iconic.settings.colorPicker1.descDesktop") : ("iconic.settings.colorPicker1.descMobile"), (Platform.isDesktop) ? (undefined) : (undefined))
				.addExtraButton((indicator) => {
					indicator.extraSettingsEl.addClass('iconic-indicator');
					this.colorPickerIndicator1 = indicator;
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							list: STRINGS.settings.values.list,
							rgb: STRINGS.settings.values.rgb,
						}), {list: ["iconic.settings.values.list"], rgb: ["iconic.settings.values.rgb"]})
						.setValue(this.plugin.settings.colorPicker1)
						.onChange((value) => {
							this.refreshIndicator(this.colorPickerIndicator1, value);
							this.plugin.settings.colorPicker1 = value;
							void this.plugin.saveSettings();
						});
					this.refreshIndicator(this.colorPickerIndicator1, dropdown.getValue());
				});
		});

		// SETTING: Second color picker
		groupIconPicker.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.colorPicker2.name), "name", "iconic.settings.colorPicker2.name")
				.setDesc(
					Platform.isDesktop
						? STRINGS.settings.colorPicker2.descDesktop
						: STRINGS.settings.colorPicker2.descMobile,
				), "desc", Platform.isDesktop ? ("iconic.settings.colorPicker2.descDesktop") : ("iconic.settings.colorPicker2.descMobile"), (Platform.isDesktop) ? (undefined) : (undefined))
				.addExtraButton((indicator) => {
					indicator.extraSettingsEl.addClass('iconic-indicator');
					this.colorPickerIndicator2 = indicator;
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							list: STRINGS.settings.values.list,
							rgb: STRINGS.settings.values.rgb,
						}), {list: ["iconic.settings.values.list"], rgb: ["iconic.settings.values.rgb"]})
						.setValue(this.plugin.settings.colorPicker2)
						.onChange((value) => {
							this.refreshIndicator(this.colorPickerIndicator2, value);
							this.plugin.settings.colorPicker2 = value;
							void this.plugin.saveSettings();
						});
					this.refreshIndicator(this.colorPickerIndicator2, dropdown.getValue());
				});
		});

		// GROUP: Advanced
		const groupAdvanced = new SettingGroup(this.section('iconic-advanced')).setHeading(
			STRINGS.settings.headingAdvanced,
		);

		// SETTING: Colorless hover
		groupAdvanced.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.uncolorHover.name), "name", "iconic.settings.uncolorHover.name")
				.setDesc(STRINGS.settings.uncolorHover.desc), "desc", "iconic.settings.uncolorHover.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.uncolorHover).onChange((value) => {
						this.plugin.settings.uncolorHover = value;
						void this.plugin.saveSettings();
						this.plugin.refreshBody();
					});
				});
		});

		// SETTING: Colorless drag
		groupAdvanced.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.uncolorDrag.name), "name", "iconic.settings.uncolorDrag.name")
				.setDesc(STRINGS.settings.uncolorDrag.desc), "desc", "iconic.settings.uncolorDrag.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.uncolorDrag).onChange((value) => {
						this.plugin.settings.uncolorDrag = value;
						void this.plugin.saveSettings();
						this.plugin.refreshBody();
					});
				});
		});

		// SETTING: Colorless selection
		groupAdvanced.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.uncolorSelect.name), "name", "iconic.settings.uncolorSelect.name")
				.setDesc(STRINGS.settings.uncolorSelect.desc), "desc", "iconic.settings.uncolorSelect.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.uncolorSelect).onChange((value) => {
						this.plugin.settings.uncolorSelect = value;
						void this.plugin.saveSettings();
						this.plugin.refreshBody();
					});
				});
		});

		// SETTING: Colorless ribbon button
		groupAdvanced.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.uncolorQuick.name), "name", "iconic.settings.uncolorQuick.name")
				.setDesc(STRINGS.settings.uncolorQuick.desc), "desc", "iconic.settings.uncolorQuick.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.uncolorQuick).onChange((value) => {
						this.plugin.settings.uncolorQuick = value;
						void this.plugin.saveSettings();
						this.plugin.refreshManagers('ribbon');
					});
				});
		});

		// SETTING: View unused icons
		groupAdvanced.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.viewUnusedIcons.name), "name", "iconic.settings.viewUnusedIcons.name")
				.setDesc(STRINGS.settings.viewUnusedIcons.desc), "desc", "iconic.settings.viewUnusedIcons.desc")
				.addButton((button) => {
					bindLocalizedControl(button.setButtonText(STRINGS.settings.manage), "buttonText", "iconic.settings.manage").onClick(async () => {
						const unusedIcons: FileItem[] = [];
						for (const fileId of Object.keys(this.plugin.settings.fileIcons)) {
							if (!(await this.app.vault.adapter.exists(fileId))) {
								const file = this.plugin.getFileItem(fileId);
								unusedIcons.push(file);
							}
						}
						UsageChecker.open(this.plugin, unusedIcons);
					});
				});
		});

		// SETTING: Maximum automatic backups
		groupAdvanced.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(STRINGS.settings.maxBackups.name), "name", "iconic.settings.maxBackups.name")
				.setDesc(STRINGS.settings.maxBackups.desc), "desc", "iconic.settings.maxBackups.desc")
				.then((setting) => {
					if (Platform.isDesktop)
						setting.addExtraButton((button) => {
							bindLocalizedControl(button
								.setIcon('lucide-folder-open')
								.setTooltip(STRINGS.settings.maxBackups.openPluginFolder), "tooltip", "iconic.settings.maxBackups.openPluginFolder")
								.onClick(() => {
									internalApp(this.app).openWithDefaultApp(this.plugin.manifest.dir ?? '');
								});
						});
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							0: STRINGS.settings.values.none,
							1: '1',
							2: '2',
							3: '3',
							4: '4',
							5: '5',
							6: '6',
							7: '7',
							8: '8',
							9: '9',
						}), {0: ["iconic.settings.values.none"]})
						.setValue(this.plugin.settings.maxBackups.toString())
						.onChange((value) => {
							this.plugin.settings.maxBackups = Number(value) || 0;
							void this.plugin.saveSettings();
						});
				});
		});
	}

	/**
	 * Change a dropdown indicator icon.
	 */
	private refreshIndicator(indicator: ExtraButtonComponent | undefined, value: string): void {
		if (!indicator) return;
		switch (value) {
			case 'desktop':
				indicator.setIcon('lucide-monitor');
				break;
			case 'mobile':
				indicator.setIcon('lucide-tablet-smartphone');
				break;
			case 'list':
				indicator.setIcon('lucide-paint-bucket');
				break;
			case 'rgb':
				indicator.setIcon('lucide-pipette');
				break;
			default:
				indicator.extraSettingsEl.hide();
				return;
		}
		indicator.extraSettingsEl.show();
	}
}

export const ICONIC_SETTINGS_PAGES = [
	'iconic-general',
	'iconic-sidebars',
	'iconic-editor',
	'iconic-menus',
	'iconic-picker',
	'iconic-advanced',
] as const;
