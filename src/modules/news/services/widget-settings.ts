import type { SettingsHandle } from '../../../shared/settings/store';
import { defaultNewsWidgets, type NewsWidgetConfig } from '../core/home-widgets';
import type { NewsSettings } from '../settings';

/** Restore only this instance on a failed write; leave concurrent changes to other instances intact. */
export async function saveNewsWidget(handle: SettingsHandle<NewsSettings>, id: string, value?: NewsWidgetConfig): Promise<void> {
	const before = (handle.get().widgets ?? defaultNewsWidgets()).find(item => item.id === id);
	const change = (settings: NewsSettings, next?: NewsWidgetConfig) => {
		const widgets = settings.widgets ?? defaultNewsWidgets();
		settings.widgets = widgets.some(item => item.id === id) ? widgets.flatMap(item => item.id === id ? next ? [next] : [] : [item]) : next ? [...widgets, next] : widgets;
	};
	const pending = handle.update(settings => change(settings, value));
	const written = JSON.stringify(handle.get().widgets?.find(item => item.id === id));
	try { await pending; }
	catch (error) {
		if (JSON.stringify(handle.get().widgets?.find(item => item.id === id)) === written) {
			// update restores memory synchronously even if the recovery write also fails.
			await handle.update(settings => change(settings, before), { persist: 'immediate' }).catch(() => undefined);
		}
		throw error;
	}
}
