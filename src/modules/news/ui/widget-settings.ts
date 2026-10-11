import { Setting } from 'obsidian';
import type { HomeWidgetContext, HomeWidgetInstance } from '../../home/api';
import type { SettingsPageHost } from '../../../app/contracts/module';
import type { SettingsHandle } from '../../../shared/settings/store';
import { t } from '../../../shared/i18n';
import { bindLocalizedControl } from '../../../ui/primitives/localized-dom';
import { defaultNewsWidgets, type NewsWidgetMode } from '../core/home-widgets';
import type { NewsSettings } from '../settings';
import { sourceSetting } from './source-settings';
import { saveNewsWidget } from '../services/widget-settings';

export type NewsWidgetEditor = (mode: NewsWidgetMode, context: Pick<HomeWidgetContext, 'signal' | 'register' | 'instanceId'>, create: boolean) => Promise<HomeWidgetInstance | null>;

export function widgetSettings(container: HTMLElement, handle: SettingsHandle<NewsSettings>, host: SettingsPageHost, configure: NewsWidgetEditor): void {
	const controller = new AbortController(), owned = new Set<() => void>();
	host.keep(() => { controller.abort(); for (const off of owned) off(); owned.clear(); });
	sourceSetting(container, 'news.widget.heading').setHeading();
	const status = container.createEl('p', { attr: { role: 'status' } });
	const edit = async (mode: NewsWidgetMode, instanceId = '') => {
		status.empty();
		try { await configure(mode, { instanceId, signal: controller.signal, register: off => owned.add(off) }, !instanceId); }
		catch { if (!controller.signal.aborted) status.setText(t('news.widget.saveFailed')); }
	};
	for (const mode of ['featured', 'hot', 'view'] as const) sourceSetting(container, `news.widget.${mode}`)
		.addButton(button => bindLocalizedControl(button.setButtonText(t('news.widget.create')), 'buttonText', 'news.widget.create').onClick(() => edit(mode)));
	const list = container.createDiv({ cls: 'nand-news-widget-settings' });
	const paint = () => {
		list.empty();
		for (const widget of handle.get().widgets ?? defaultNewsWidgets()) {
			const name = widget.name || handle.get().views.find(view => view.id === widget.viewId)?.name;
			const row = new Setting(list);
			if (name) row.setName(name); else bindLocalizedControl(row.setName(t(`news.widget.${widget.mode}`)), 'name', `news.widget.${widget.mode}`);
			row.addButton(button => bindLocalizedControl(button.setButtonText(t('news.widget.configure')), 'buttonText', 'news.widget.configure').onClick(() => edit(widget.mode, widget.id)))
				.addButton(button => bindLocalizedControl(button.setButtonText(t('news.widget.delete')), 'buttonText', 'news.widget.delete').onClick(async () => {
					try { await saveNewsWidget(handle, widget.id); }
					catch { if (!controller.signal.aborted) status.setText(t('news.widget.saveFailed')); }
				}));
		}
	};
	const snapshot = () => JSON.stringify([handle.get().widgets, handle.get().views]);
	let previous = snapshot();
	host.keep(handle.subscribe(() => { const next = snapshot(); if (next !== previous) { previous = next; paint(); } }));
	paint();
}
