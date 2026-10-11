import type { SettingsHandle, SettingsStore } from '../../../shared/settings/store';
import { themeSettings } from '../../../theme/settings';
import { t } from '../../../shared/i18n';
import { appearanceNameKey, homeDecor } from '../core/board/appearance-preset';
import type { DashboardSettings } from '../core/board/types/model';

/** Uses the existing shared write batch; theme and home retain their namespace ownership. */
export class AppearancePresets {
	private readonly theme;
	constructor(private readonly store: SettingsStore, private readonly home: SettingsHandle<DashboardSettings>) {
		this.theme = store.bind('theme', themeSettings);
	}
	get presets() { return this.home.get().appearancePresets; }
	get activeId() { return this.home.get().activeAppearancePresetId; }
	get status() { return this.store.status; }
	subscribe(listener: () => void): () => void {
		const offs = [this.home.subscribe(listener), this.theme.subscribe(listener), this.store.onStatus(listener)];
		return () => offs.forEach(off => off());
	}
	async save(name: string): Promise<void> {
		name = name.trim();
		if (!name) throw new Error(t('appearancePresets.nameRequired'));
		if (this.presets.some(preset => appearanceNameKey(preset.name) === appearanceNameKey(name))) throw new Error(t('appearancePresets.duplicate'));
		const snapshot = { id: crypto.randomUUID(), name, theme: themeSettings.normalize(this.theme.get()), home: homeDecor(this.home.get()) };
		await this.home.update(draft => { draft.appearancePresets.push(snapshot); draft.activeAppearancePresetId = snapshot.id; });
	}
	async apply(id: string): Promise<void> {
		const preset = this.presets.find(item => item.id === id);
		if (!preset) throw new Error(t('appearancePresets.missing'));
		await Promise.all([
			this.theme.update(() => themeSettings.normalize(preset.theme)),
			this.home.update(draft => { Object.assign(draft, homeDecor(preset.home)); draft.activeAppearancePresetId = id; }),
			this.store.flush(),
		]);
	}
	async remove(id: string): Promise<void> {
		await this.home.update(draft => {
			draft.appearancePresets = draft.appearancePresets.filter(preset => preset.id !== id);
			if (draft.activeAppearancePresetId === id) delete draft.activeAppearancePresetId;
		});
	}
	retry(): Promise<void> { return this.store.flush(); }
}
