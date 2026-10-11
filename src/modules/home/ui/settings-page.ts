import type { HomeHost } from '../services/home-host';
import type { SettingsPageRenderer } from '../../../app/contracts/module';
import { BoardSettingsTab } from './settings/board-settings-tab';
import { closeOwnedDashboardDialogs } from './ui/dialog-scope';

/** The home module's page in workbench settings. */
export const homeSettingsPage = (plugin: HomeHost): SettingsPageRenderer => (container, host) => {
	const tab = new BoardSettingsTab(plugin, host);
	host.keep(() => closeOwnedDashboardDialogs(plugin.app, tab));
	tab.render(container);
};
