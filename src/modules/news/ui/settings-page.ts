import { t } from '../../../shared/i18n';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { NewsActions } from '../services/news-actions';
import type { NewsSettings } from '../settings';
import type { NotificationChannelId } from '../../notifications/api';
import type { SettingsPageHost } from '../../../app/contracts/module';
import { bindLocalizedControl, bindLocalizedOptions, setLocalizedText } from '../../../ui/primitives/localized-dom';
import { sourceEditor, sourceError, sourceSetting } from './source-settings';
import { analysisSettings } from './analysis-settings';
import { editorialSettings } from './editorial-settings';
import { storageSettings } from './storage-settings';
import { widgetSettings, type NewsWidgetEditor } from './widget-settings';

export function newsSettingsPage(handle: SettingsHandle<NewsSettings>, actions: NewsActions, configureWidget: NewsWidgetEditor) {
	return (root: HTMLElement, host: SettingsPageHost) => {
		const container = root.createDiv({ cls: 'nand-news-settings' });
		sourceSetting(container, 'news.settings.heading').setHeading();
		sourceSetting(container, 'news.settings.enabled').addToggle((toggle) =>
			toggle.setValue(handle.get().enabled).onChange(async (value) => {
				try {
					if (value) await actions.enable();
					else await handle.update((settings) => { settings.enabled = false; });
				} catch (error) { status.setText(sourceError(error)); }
			}),
		);
		for (const key of ['refreshOnStartup', 'refreshWhenStale', 'autoRefresh'] as const) sourceSetting(container, `news.settings.${key}`).addToggle(toggle => toggle.setValue(handle.get()[key] === true).onChange(async value => {
			try { await handle.update(settings => { settings[key] = value; }); } catch (error) { status.setText(sourceError(error)); }
		}));
		sourceSetting(container, 'news.settings.staleMinutes').addText(input => input.setValue(String(handle.get().staleMinutes ?? 60)).onChange(async value => {
			const minutes = Number(value);
			if (!Number.isFinite(minutes)) return;
			try { await handle.update(settings => { settings.staleMinutes = Math.max(15, Math.min(1440, Math.round(minutes))); }); } catch (error) { status.setText(sourceError(error)); }
		}));
		const status = container.createEl('p', { attr: { role: 'status' } });
		widgetSettings(container, handle, host, configureWidget);
		sourceSetting(container, 'news.settings.analysis').addToggle((toggle) =>
			toggle.setValue(handle.get().analysisEnabled).onChange(async (value) => {
				try { await handle.update((settings) => { settings.analysisEnabled = value; }); } catch (error) { status.setText(sourceError(error)); }
			}),
		);
		const preview = container.createDiv({ cls: 'nand-news-edition' });
		analysisSettings(container, handle, actions, host);
		editorialSettings(container, handle, host);
		storageSettings(container, handle, host);
		const paintEdition = () => {
			preview.empty();
			const edition = actions.edition();
			if (!edition) return;
			preview.setText(`${t('news.edition')} ${edition.date}`);
		};
		sourceSetting(container, 'news.settings.daily').addToggle((toggle) =>
			toggle.setValue(handle.get().writeDailyNote).onChange(async (value) => {
				try { await handle.update((settings) => { settings.writeDailyNote = value; }); paintEdition(); } catch (error) { status.setText(sourceError(error)); }
			}),
		);
		paintEdition();
		sourceSetting(container, 'news.settings.notifyOn').addDropdown(dropdown => {
			for (const value of ['failure', 'always', 'never'] as const) dropdown.addOption(value, t(`news.notify.${value}`));
			bindLocalizedOptions(dropdown, { failure: ['news.notify.failure'], always: ['news.notify.always'], never: ['news.notify.never'] });
			dropdown.setValue(handle.get().notifyOn ?? 'failure').onChange(async value => {
				try { await handle.update(draft => { draft.notifyOn = value as 'failure' | 'always' | 'never'; }); } catch (error) { status.setText(sourceError(error)); }
			});
		});
		for (const channel of ['in-app', 'system'] as const) sourceSetting(container, `news.channel.${channel}`).addToggle(toggle => toggle.setValue((handle.get().notificationChannels ?? ['in-app']).includes(channel)).onChange(async enabled => {
			try { await handle.update(draft => { const selected = new Set<NotificationChannelId>(draft.notificationChannels ?? ['in-app']); if (enabled) selected.add(channel); else selected.delete(channel); draft.notificationChannels = [...selected]; }); } catch (error) { status.setText(sourceError(error)); }
		}));
		let url = '';
		sourceSetting(container, 'news.source').addText((text) => text.onChange((value) => { url = value; })).addButton((button) =>
			bindLocalizedControl(button.setButtonText(t('news.addSource')), 'buttonText', 'news.addSource').onClick(async () => {
				try {
					const added = await actions.addSource(url);
					if (added) { url = ''; paintSources(); setLocalizedText(status, 'news.source.saved'); }
					else setLocalizedText(status, 'news.source.invalid');
				} catch (error) { status.setText(sourceError(error)); }
			}),
		);
		let opml = '';
		const opmlRow = sourceSetting(container, 'news.opml');
		opmlRow.addTextArea(area => {
			area.onChange(value => { opml = value; });
			opmlRow.addButton(button => bindLocalizedControl(button.setButtonText(t('news.exportOpml')), 'buttonText', 'news.exportOpml').onClick(() => { opml = actions.exportOpml(); area.setValue(opml); }));
		});
		opmlRow.addButton(button => bindLocalizedControl(button.setButtonText(t('news.importOpml')), 'buttonText', 'news.importOpml').onClick(async () => {
			try { const report = await actions.importOpml(opml); paintSources(); setLocalizedText(status, 'news.opml.report', { ...report }); } catch (error) { status.setText(sourceError(error)); }
		}));
		const sources = container.createDiv();
		let sourceDisposers: (() => void)[] = [];
		const paintSources = (): void => {
			for (const off of sourceDisposers.splice(0)) off();
			sources.empty();
			for (const source of handle.get().sources) sourceDisposers.push(sourceEditor(sources, source, actions, paintSources));
		};
		paintSources();
		host.keep(() => { for (const off of sourceDisposers.splice(0)) off(); });
		sourceSetting(container, 'news.analyze').addButton((button) =>
			bindLocalizedControl(button.setButtonText(t('news.analyze')), 'buttonText', 'news.analyze').onClick(async () => {
				try { await actions.enable(); await actions.analyze(); } catch (error) { status.setText(sourceError(error)); }
			}),
		);
	};
}
