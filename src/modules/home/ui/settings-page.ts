import type { HomeHost } from '../services/home-host';
import type { SettingsPageRenderer } from '../../../app/contracts/module';
import { BoardSettingsTab } from './settings/board-settings-tab';

/** The home module's page in workbench settings. */
export const homeSettingsPage = (plugin: HomeHost): SettingsPageRenderer => (container, host) => {
	new BoardSettingsTab(plugin, host).render(container);
};
