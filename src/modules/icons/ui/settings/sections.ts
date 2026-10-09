import { bindLocalizedOptions } from '../../../../ui/primitives/localized-dom';
import { bindLocalizedControl } from '../../../../ui/primitives/localized-dom';
import { ExtraButtonComponent, Platform, requireApiVersion, SettingDefinitionGroup, SettingGroup } from 'obsidian';
import type { FileItem } from '../../core/types';
import type IconicController from '../../platform/host/controller';
import { internalApp } from '../../platform/utils/obsidian-internal';
import { t } from '../../../../shared/i18n';
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
				name: t('iconic.settings.rulebook.name'),
				desc: t('iconic.settings.rulebook.desc'),
				render: (setting) => {
					setting.addButton((button) => {
						bindLocalizedControl(button.setButtonText(t('iconic.settings.manage')), "buttonText", "iconic.settings.manage").onClick(() => {
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
				name: t('iconic.settings.biggerIcons.name'),
				desc: t('iconic.settings.biggerIcons.desc'),
				render: (setting) => {
					setting
						.addExtraButton((indicator) => {
							indicator.extraSettingsEl.addClass('iconic-indicator');
							this.biggerIconsIndicator = indicator;
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									on: t('iconic.settings.values.on'),
									desktop: t('iconic.settings.values.desktop'),
									mobile: t('iconic.settings.values.mobile'),
									off: t('iconic.settings.values.off'),
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
					? t('iconic.settings.clickableIcons.nameDesktop')
					: t('iconic.settings.clickableIcons.nameMobile'),
				desc: Platform.isDesktop
					? t('iconic.settings.clickableIcons.descDesktop')
					: t('iconic.settings.clickableIcons.descMobile'),
				render: (setting) => {
					setting
						.addExtraButton((indicator) => {
							indicator.extraSettingsEl.addClass('iconic-indicator');
							this.clickableIconsIndicator = indicator;
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									on: t('iconic.settings.values.on'),
									desktop: t('iconic.settings.values.desktop'),
									mobile: t('iconic.settings.values.mobile'),
									off: t('iconic.settings.values.off'),
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
				heading: t('iconic.settings.headingSidebarsAndTabs'),
				items: [],
			};

			// SETTING: Show all file icons
			groupSidebarsAndTabs.items?.push({
				name: t('iconic.settings.showAllFileIcons.name'),
				desc: t('iconic.settings.showAllFileIcons.desc'),
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
				name: t('iconic.settings.showAllFolderIcons.name'),
				desc: t('iconic.settings.showAllFolderIcons.desc'),
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
				name: t('iconic.settings.minimalFolderIcons.name'),
				desc: t('iconic.settings.minimalFolderIcons.desc'),
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
				name: t('iconic.settings.showMarkdownTabIcons.name'),
				desc: t('iconic.settings.showMarkdownTabIcons.desc'),
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
				heading: t('iconic.settings.headingEditor'),
				items: [],
			};

			// SETTING: Show title icons
			groupEditor.items?.push({
				name: t('iconic.settings.showTitleIcons.name'),
				desc: t('iconic.settings.showTitleIcons.desc'),
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
				name: t('iconic.settings.showTagPillIcons.name'),
				desc: t('iconic.settings.showTagPillIcons.desc'),
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
				heading: t('iconic.settings.headingMenusAndDialogs'),
				items: [],
			};

			// SETTING: Show menu actions
			groupMenusAndDialogs.items?.push({
				name: t('iconic.settings.showMenuActions.name'),
				desc: t('iconic.settings.showMenuActions.desc'),
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
				name: t('iconic.settings.showSuggestionIcons.name'),
				desc: t('iconic.settings.showSuggestionIcons.desc'),
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
				name: t('iconic.settings.showQuickSwitcherIcons.name'),
				desc: t('iconic.settings.showQuickSwitcherIcons.desc'),
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
				name: t('iconic.settings.showMoveFileIcons.name'),
				desc: t('iconic.settings.showMoveFileIcons.desc'),
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
				heading: t('iconic.settings.headingIconPicker'),
				items: [],
			};

			// SETTING: Show item name
			groupIconPicker.items?.push({
				name: t('iconic.settings.showItemName.name'),
				desc: t('iconic.settings.showItemName.desc'),
				render: (setting) => {
					setting
						.addExtraButton((indicator) => {
							indicator.extraSettingsEl.addClass('iconic-indicator');
							this.showItemNameIndicator = indicator;
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									on: t('iconic.settings.values.on'),
									desktop: t('iconic.settings.values.desktop'),
									mobile: t('iconic.settings.values.mobile'),
									off: t('iconic.settings.values.off'),
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
				name: t('iconic.settings.useSearchKeywords.name'),
				desc: t('iconic.settings.useSearchKeywords.desc'),
				render: (setting) => {
					setting
						.addExtraButton((indicator) => {
							indicator.extraSettingsEl.addClass('iconic-indicator');
							this.useSearchKeywordsIndicator = indicator;
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									on: t('iconic.settings.values.on'),
									desktop: t('iconic.settings.values.desktop'),
									mobile: t('iconic.settings.values.mobile'),
									off: t('iconic.settings.values.off'),
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
				name: t('iconic.settings.maxSearchResults.name'),
				desc: t('iconic.settings.maxSearchResults.desc'),
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
				name: t('iconic.settings.colorPicker1.name'),
				desc: Platform.isDesktop
					? t('iconic.settings.colorPicker1.descDesktop')
					: t('iconic.settings.colorPicker1.descMobile'),
				render: (setting) => {
					setting
						.addExtraButton((indicator) => {
							indicator.extraSettingsEl.addClass('iconic-indicator');
							this.colorPickerIndicator1 = indicator;
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									list: t('iconic.settings.values.list'),
									rgb: t('iconic.settings.values.rgb'),
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
				name: t('iconic.settings.colorPicker2.name'),
				desc: Platform.isDesktop
					? t('iconic.settings.colorPicker2.descDesktop')
					: t('iconic.settings.colorPicker2.descMobile'),
				render: (setting) => {
					setting
						.addExtraButton((indicator) => {
							indicator.extraSettingsEl.addClass('iconic-indicator');
							this.colorPickerIndicator2 = indicator;
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									list: t('iconic.settings.values.list'),
									rgb: t('iconic.settings.values.rgb'),
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
				heading: t('iconic.settings.headingAdvanced'),
				items: [],
			};

			// SETTING: Colorless hover
			groupAdvanced.items?.push({
				name: t('iconic.settings.uncolorHover.name'),
				desc: t('iconic.settings.uncolorHover.desc'),
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
				name: t('iconic.settings.uncolorDrag.name'),
				desc: t('iconic.settings.uncolorDrag.desc'),
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
				name: t('iconic.settings.uncolorSelect.name'),
				desc: t('iconic.settings.uncolorSelect.desc'),
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
				name: t('iconic.settings.uncolorQuick.name'),
				desc: t('iconic.settings.uncolorQuick.desc'),
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
				name: t('iconic.settings.viewUnusedIcons.name'),
				desc: t('iconic.settings.viewUnusedIcons.desc'),
				render: (setting) => {
					setting.addButton((button) => {
						bindLocalizedControl(button.setButtonText(t('iconic.settings.manage')), "buttonText", "iconic.settings.manage").onClick(async () => {
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
				name: t('iconic.settings.maxBackups.name'),
				desc: t('iconic.settings.maxBackups.desc'),
				render: (setting) => {
					setting
						.then((setting) => {
							if (Platform.isDesktop)
								setting.addExtraButton((button) => {
									bindLocalizedControl(button
										.setIcon('lucide-folder-open')
										.setTooltip(t('iconic.settings.maxBackups.openPluginFolder')), "tooltip", "iconic.settings.maxBackups.openPluginFolder")
										.onClick(() => {
											internalApp(this.app).openWithDefaultApp(this.plugin.manifest.dir ?? '');
										});
								});
						})
						.addDropdown((dropdown) => {
							bindLocalizedOptions(dropdown
								.addOptions({
									0: t('iconic.settings.values.none'),
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
				.setName(t('iconic.settings.rulebook.name')), "name", "iconic.settings.rulebook.name")
				.setDesc(t('iconic.settings.rulebook.desc')), "desc", "iconic.settings.rulebook.desc")
				.addButton((button) => {
					bindLocalizedControl(button.setButtonText(t('iconic.settings.manage')), "buttonText", "iconic.settings.manage").onClick(() => {
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
				.setName(t('iconic.settings.biggerIcons.name')), "name", "iconic.settings.biggerIcons.name")
				.setDesc(t('iconic.settings.biggerIcons.desc')), "desc", "iconic.settings.biggerIcons.desc")
				.addExtraButton((indicator) => {
					indicator.extraSettingsEl.addClass('iconic-indicator');
					this.biggerIconsIndicator = indicator;
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							on: t('iconic.settings.values.on'),
							desktop: t('iconic.settings.values.desktop'),
							mobile: t('iconic.settings.values.mobile'),
							off: t('iconic.settings.values.off'),
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
						? t('iconic.settings.clickableIcons.nameDesktop')
						: t('iconic.settings.clickableIcons.nameMobile'),
				), "name", Platform.isDesktop ? ("iconic.settings.clickableIcons.nameDesktop") : ("iconic.settings.clickableIcons.nameMobile"), (Platform.isDesktop) ? (undefined) : (undefined))
				.setDesc(
					Platform.isDesktop
						? t('iconic.settings.clickableIcons.descDesktop')
						: t('iconic.settings.clickableIcons.descMobile'),
				), "desc", Platform.isDesktop ? ("iconic.settings.clickableIcons.descDesktop") : ("iconic.settings.clickableIcons.descMobile"), (Platform.isDesktop) ? (undefined) : (undefined))
				.addExtraButton((indicator) => {
					indicator.extraSettingsEl.addClass('iconic-indicator');
					this.clickableIconsIndicator = indicator;
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							on: t('iconic.settings.values.on'),
							desktop: t('iconic.settings.values.desktop'),
							mobile: t('iconic.settings.values.mobile'),
							off: t('iconic.settings.values.off'),
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
			t('iconic.settings.headingSidebarsAndTabs'),
		);

		// SETTING: Show all file icons
		groupSidebarsAndTabs.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(t('iconic.settings.showAllFileIcons.name')), "name", "iconic.settings.showAllFileIcons.name")
				.setDesc(t('iconic.settings.showAllFileIcons.desc')), "desc", "iconic.settings.showAllFileIcons.desc")
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
				.setName(t('iconic.settings.showAllFolderIcons.name')), "name", "iconic.settings.showAllFolderIcons.name")
				.setDesc(t('iconic.settings.showAllFolderIcons.desc')), "desc", "iconic.settings.showAllFolderIcons.desc")
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
				.setName(t('iconic.settings.minimalFolderIcons.name')), "name", "iconic.settings.minimalFolderIcons.name")
				.setDesc(t('iconic.settings.minimalFolderIcons.desc')), "desc", "iconic.settings.minimalFolderIcons.desc")
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
				.setName(t('iconic.settings.showMarkdownTabIcons.name')), "name", "iconic.settings.showMarkdownTabIcons.name")
				.setDesc(t('iconic.settings.showMarkdownTabIcons.desc')), "desc", "iconic.settings.showMarkdownTabIcons.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.showMarkdownTabIcons).onChange((value) => {
						this.plugin.settings.showMarkdownTabIcons = value;
						void this.plugin.saveSettings();
						this.plugin.refreshBody();
					});
				});
		});

		// GROUP: Editor
		const groupEditor = new SettingGroup(this.section('iconic-editor')).setHeading(t('iconic.settings.headingEditor'));

		// SETTING: Show title icons
		groupEditor.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(t('iconic.settings.showTitleIcons.name')), "name", "iconic.settings.showTitleIcons.name")
				.setDesc(t('iconic.settings.showTitleIcons.desc')), "desc", "iconic.settings.showTitleIcons.desc")
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
				.setName(t('iconic.settings.showTagPillIcons.name')), "name", "iconic.settings.showTagPillIcons.name")
				.setDesc(t('iconic.settings.showTagPillIcons.desc')), "desc", "iconic.settings.showTagPillIcons.desc")
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
			t('iconic.settings.headingMenusAndDialogs'),
		);

		// SETTING: Show menu actions
		groupMenusAndDialogs.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(t('iconic.settings.showMenuActions.name')), "name", "iconic.settings.showMenuActions.name")
				.setDesc(t('iconic.settings.showMenuActions.desc')), "desc", "iconic.settings.showMenuActions.desc")
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
				.setName(t('iconic.settings.showSuggestionIcons.name')), "name", "iconic.settings.showSuggestionIcons.name")
				.setDesc(t('iconic.settings.showSuggestionIcons.desc')), "desc", "iconic.settings.showSuggestionIcons.desc")
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
				.setName(t('iconic.settings.showQuickSwitcherIcons.name')), "name", "iconic.settings.showQuickSwitcherIcons.name")
				.setDesc(t('iconic.settings.showQuickSwitcherIcons.desc')), "desc", "iconic.settings.showQuickSwitcherIcons.desc")
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
				.setName(t('iconic.settings.showMoveFileIcons.name')), "name", "iconic.settings.showMoveFileIcons.name")
				.setDesc(t('iconic.settings.showMoveFileIcons.desc')), "desc", "iconic.settings.showMoveFileIcons.desc")
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.showMoveFileIcons).onChange((value) => {
						this.plugin.settings.showMoveFileIcons = value;
						void this.plugin.saveSettings();
					});
				});
		});

		// GROUP: Icon picker
		const groupIconPicker = new SettingGroup(this.section('iconic-picker')).setHeading(
			t('iconic.settings.headingIconPicker'),
		);

		// SETTING: Show item name
		groupIconPicker.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(t('iconic.settings.showItemName.name')), "name", "iconic.settings.showItemName.name")
				.setDesc(t('iconic.settings.showItemName.desc')), "desc", "iconic.settings.showItemName.desc")
				.addExtraButton((indicator) => {
					indicator.extraSettingsEl.addClass('iconic-indicator');
					this.showItemNameIndicator = indicator;
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							on: t('iconic.settings.values.on'),
							desktop: t('iconic.settings.values.desktop'),
							mobile: t('iconic.settings.values.mobile'),
							off: t('iconic.settings.values.off'),
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
				.setName(t('iconic.settings.useSearchKeywords.name')), "name", "iconic.settings.useSearchKeywords.name")
				.setDesc(t('iconic.settings.useSearchKeywords.desc')), "desc", "iconic.settings.useSearchKeywords.desc")
				.addExtraButton((indicator) => {
					indicator.extraSettingsEl.addClass('iconic-indicator');
					this.useSearchKeywordsIndicator = indicator;
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							on: t('iconic.settings.values.on'),
							desktop: t('iconic.settings.values.desktop'),
							mobile: t('iconic.settings.values.mobile'),
							off: t('iconic.settings.values.off'),
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
				.setName(t('iconic.settings.maxSearchResults.name')), "name", "iconic.settings.maxSearchResults.name")
				.setDesc(t('iconic.settings.maxSearchResults.desc')), "desc", "iconic.settings.maxSearchResults.desc")
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
				.setName(t('iconic.settings.colorPicker1.name')), "name", "iconic.settings.colorPicker1.name")
				.setDesc(
					Platform.isDesktop
						? t('iconic.settings.colorPicker1.descDesktop')
						: t('iconic.settings.colorPicker1.descMobile'),
				), "desc", Platform.isDesktop ? ("iconic.settings.colorPicker1.descDesktop") : ("iconic.settings.colorPicker1.descMobile"), (Platform.isDesktop) ? (undefined) : (undefined))
				.addExtraButton((indicator) => {
					indicator.extraSettingsEl.addClass('iconic-indicator');
					this.colorPickerIndicator1 = indicator;
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							list: t('iconic.settings.values.list'),
							rgb: t('iconic.settings.values.rgb'),
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
				.setName(t('iconic.settings.colorPicker2.name')), "name", "iconic.settings.colorPicker2.name")
				.setDesc(
					Platform.isDesktop
						? t('iconic.settings.colorPicker2.descDesktop')
						: t('iconic.settings.colorPicker2.descMobile'),
				), "desc", Platform.isDesktop ? ("iconic.settings.colorPicker2.descDesktop") : ("iconic.settings.colorPicker2.descMobile"), (Platform.isDesktop) ? (undefined) : (undefined))
				.addExtraButton((indicator) => {
					indicator.extraSettingsEl.addClass('iconic-indicator');
					this.colorPickerIndicator2 = indicator;
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							list: t('iconic.settings.values.list'),
							rgb: t('iconic.settings.values.rgb'),
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
			t('iconic.settings.headingAdvanced'),
		);

		// SETTING: Colorless hover
		groupAdvanced.addSetting((setting) => {
			bindLocalizedControl(bindLocalizedControl(setting
				.setName(t('iconic.settings.uncolorHover.name')), "name", "iconic.settings.uncolorHover.name")
				.setDesc(t('iconic.settings.uncolorHover.desc')), "desc", "iconic.settings.uncolorHover.desc")
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
				.setName(t('iconic.settings.uncolorDrag.name')), "name", "iconic.settings.uncolorDrag.name")
				.setDesc(t('iconic.settings.uncolorDrag.desc')), "desc", "iconic.settings.uncolorDrag.desc")
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
				.setName(t('iconic.settings.uncolorSelect.name')), "name", "iconic.settings.uncolorSelect.name")
				.setDesc(t('iconic.settings.uncolorSelect.desc')), "desc", "iconic.settings.uncolorSelect.desc")
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
				.setName(t('iconic.settings.uncolorQuick.name')), "name", "iconic.settings.uncolorQuick.name")
				.setDesc(t('iconic.settings.uncolorQuick.desc')), "desc", "iconic.settings.uncolorQuick.desc")
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
				.setName(t('iconic.settings.viewUnusedIcons.name')), "name", "iconic.settings.viewUnusedIcons.name")
				.setDesc(t('iconic.settings.viewUnusedIcons.desc')), "desc", "iconic.settings.viewUnusedIcons.desc")
				.addButton((button) => {
					bindLocalizedControl(button.setButtonText(t('iconic.settings.manage')), "buttonText", "iconic.settings.manage").onClick(async () => {
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
				.setName(t('iconic.settings.maxBackups.name')), "name", "iconic.settings.maxBackups.name")
				.setDesc(t('iconic.settings.maxBackups.desc')), "desc", "iconic.settings.maxBackups.desc")
				.then((setting) => {
					if (Platform.isDesktop)
						setting.addExtraButton((button) => {
							bindLocalizedControl(button
								.setIcon('lucide-folder-open')
								.setTooltip(t('iconic.settings.maxBackups.openPluginFolder')), "tooltip", "iconic.settings.maxBackups.openPluginFolder")
								.onClick(() => {
									internalApp(this.app).openWithDefaultApp(this.plugin.manifest.dir ?? '');
								});
						});
				})
				.addDropdown((dropdown) => {
					bindLocalizedOptions(dropdown
						.addOptions({
							0: t('iconic.settings.values.none'),
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
