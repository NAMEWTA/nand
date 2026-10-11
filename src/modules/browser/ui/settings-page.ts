import { Notice, Platform, Setting } from 'obsidian';
import type { SettingsPageRenderer } from '../../../app/contracts/module';
import { t } from '../../../shared/i18n';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { BrowserOpener } from '../api';
import type { BrowserSettings, SearchEngine } from '../core/model';
import { browserError } from '../core/text';
import type { BrowserModule } from '../services';
import { profileSettings } from './profile-settings';
import { DEFAULT_WORKSPACE_FOLDER, workspaceFolder } from '../core/workspace/location';

/** Settings → Browser: search engine, agent access to the browser and the connection command. */
export function browserSettingsPage(current: () => BrowserModule, settings: SettingsHandle<BrowserSettings>, opener: BrowserOpener): SettingsPageRenderer {
	const save = (recipe: (draft: BrowserSettings) => void) => { void settings.update(recipe).catch((error: unknown) => new Notice(browserError(error))); };
	return (container, page) => {
		new Setting(container)
			.setName(t('browser.open'))
			.setDesc(Platform.isDesktopApp ? t('browser.description') : t('browser.mobile'))
			.addButton((button) => button.setIcon('globe').setTooltip(t('browser.open')).onClick(() => { void opener.show({}); }));
		new Setting(container).setName(t('browser.searchEngine')).addDropdown((dropdown) =>
			dropdown
				.addOptions({ google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo' })
				.setValue(settings.get().searchEngine)
				.onChange((value) => save((draft) => { draft.searchEngine = value as SearchEngine; })),
		);
		let folder = settings.get().workspaceFolder ?? DEFAULT_WORKSPACE_FOLDER;
		new Setting(container).setName(t('browser.workspace.folder')).setDesc(t('browser.workspace.folderHint'))
			.addText(text => text.setValue(folder).onChange(value => { folder = value; }))
			.addButton(button => button.setButtonText(t('browser.workspace.folderApply')).onClick(async () => {
				const normalized = workspaceFolder(folder);
				if (!normalized) { new Notice(t('browser.browser_workspace_folder')); return; }
				try { await settings.update(draft => { draft.workspaceFolder = normalized; }); page.refresh(); }
				catch (error) { new Notice(browserError(error)); }
			}));
		if (!Platform.isDesktopApp) return;
		profileSettings(container, current(), page);
		new Setting(container).setName(t('browser.access.title')).setDesc(t('browser.access.intro'))
			.addButton(button => button.setButtonText(t('browser.access.open')).onClick(() => { void current().openAccess(container.win).catch(error => new Notice(browserError(error))); }));
		new Setting(container)
			.setName(t('browser.agentAccess'))
			.setDesc(t('browser.agentAccessDesc'))
			.addToggle((toggle) => toggle.setValue(settings.get().agentAccess).onChange((value) => {
				save((draft) => { draft.agentAccess = value; });
				page.refresh();
			}));
		if (!settings.get().agentAccess) return;
		new Setting(container)
			.setName(t('browser.connection'))
			.setDesc(t('browser.connectionHint'))
			.addButton((button) =>
				button.setButtonText(t('browser.copyConnection')).onClick(async () => {
					try {
						const host = current();
						host.copyText(await host.connectionCommand());
						new Notice(t('browser.copied'));
					} catch (error) {
						new Notice(browserError(error));
					}
				}),
			);
	};
}
