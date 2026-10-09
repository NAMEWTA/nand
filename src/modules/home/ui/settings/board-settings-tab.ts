import type { App } from 'obsidian';
import type { HomeHost } from '../../services/home-host';
import type { SettingsPageHost } from '../../../../app/contracts/module';
import type { AlbumConfig, AnniversaryConfig, CountdownConfig } from '../../core/board/types/index';
import { applyAlbumUpdate, editAlbum, renderAlbumSettings } from './album-settings';
import { applyAnniversaryUpdate, editAnniversary, renderAnniversarySettings } from './anniversary-settings';
import { renderCalendarSettings } from './calendar-settings';
import { applyCountdownUpdate, editCountdown, renderCountdownList } from './countdown-settings';
import { renderGeneralSettings } from './general';
import { renderServiceSettings } from './services';
import { renderWidgetBackgroundSetting } from './widget-background-setting';
import {
	attachCitySuggest,
	renderLunarSettings,
	renderWeatherSettings,
	renderWidgetSettings,
	renderYearProgressSettings,
	suggestCities,
} from './widgets-settings';
import { renderWorkspaceSettings } from './workspace-settings';

/** Board settings renderers (the home module's settings page); each section is a method so they can call each other. */
export class BoardSettingsTab {
	declare renderGeneralSettings: (containerEl: HTMLElement) => void;
	declare renderWorkspaceSettings: (containerEl: HTMLElement) => void;
	declare renderServiceSettings: (containerEl: HTMLElement) => void;
	declare renderWidgetSettings: (containerEl: HTMLElement) => void;
	declare renderWeatherSettings: (containerEl: HTMLElement) => void;
	declare renderLunarSettings: (containerEl: HTMLElement) => void;
	declare renderYearProgressSettings: (containerEl: HTMLElement) => void;
	declare attachCitySuggest: (inputEl: HTMLInputElement) => void;
	declare suggestCities: (
		inputEl: HTMLInputElement,
		query: string,
		dropdown: HTMLElement | null,
		close: () => void,
	) => Promise<HTMLElement | null>;
	declare renderCountdownList: (containerEl: HTMLElement) => void;
	declare editCountdown: (existing: CountdownConfig | null) => void;
	declare applyCountdownUpdate: (updated: CountdownConfig) => Promise<void>;
	declare renderAlbumSettings: (containerEl: HTMLElement) => void;
	declare editAlbum: (existing: AlbumConfig | null) => void;
	declare applyAlbumUpdate: (updated: AlbumConfig) => Promise<void>;
	declare renderAnniversarySettings: (containerEl: HTMLElement) => void;
	declare editAnniversary: (existing: AnniversaryConfig | null) => void;
	declare applyAnniversaryUpdate: (updated: AnniversaryConfig) => Promise<void>;
	declare renderCalendarSettings: (containerEl: HTMLElement) => void;
	declare renderWidgetBackgroundSetting: (
		containerEl: HTMLElement,
		key:
			| 'quickActionsBackground'
			| 'pomodoroBackground'
			| 'habitBackground'
			| 'musicBackground'
			| 'yearProgressBackground',
	) => void;

	readonly app: App;

	constructor(readonly plugin: HomeHost, private readonly host: SettingsPageHost) {
		this.app = plugin.app;
	}

	/** Redraw the page (a widget toggled, a countdown added, ...). */
	refresh(): void {
		this.host.refresh();
	}

	render(container: HTMLElement): void {
		this.renderGeneralSettings(container);
		this.renderServiceSettings(container);
		this.renderWeatherSettings(container);
		this.renderCalendarSettings(container);
		this.renderWidgetSettings(container);
		this.renderLunarSettings(container);
		this.renderYearProgressSettings(container);
		this.renderAlbumSettings(container);
		this.renderAnniversarySettings(container);
	}
}

BoardSettingsTab.prototype.renderGeneralSettings = renderGeneralSettings;
BoardSettingsTab.prototype.renderWorkspaceSettings = renderWorkspaceSettings;
BoardSettingsTab.prototype.renderServiceSettings = renderServiceSettings;
BoardSettingsTab.prototype.renderWidgetSettings = renderWidgetSettings;
BoardSettingsTab.prototype.renderWeatherSettings = renderWeatherSettings;
BoardSettingsTab.prototype.renderLunarSettings = renderLunarSettings;
BoardSettingsTab.prototype.renderYearProgressSettings = renderYearProgressSettings;
BoardSettingsTab.prototype.attachCitySuggest = attachCitySuggest;
BoardSettingsTab.prototype.suggestCities = suggestCities;
BoardSettingsTab.prototype.renderCountdownList = renderCountdownList;
BoardSettingsTab.prototype.editCountdown = editCountdown;
BoardSettingsTab.prototype.applyCountdownUpdate = applyCountdownUpdate;
BoardSettingsTab.prototype.renderAlbumSettings = renderAlbumSettings;
BoardSettingsTab.prototype.editAlbum = editAlbum;
BoardSettingsTab.prototype.applyAlbumUpdate = applyAlbumUpdate;
BoardSettingsTab.prototype.renderAnniversarySettings = renderAnniversarySettings;
BoardSettingsTab.prototype.editAnniversary = editAnniversary;
BoardSettingsTab.prototype.applyAnniversaryUpdate = applyAnniversaryUpdate;
BoardSettingsTab.prototype.renderCalendarSettings = renderCalendarSettings;
BoardSettingsTab.prototype.renderWidgetBackgroundSetting = renderWidgetBackgroundSetting;
