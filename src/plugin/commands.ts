import { NAND_COMMANDS } from '../shared/commands';
import { t } from '../shared/i18n/index';
import type DashboardPlugin from './main';

/** Shell commands. Products register their own commands from their host. */
export function registerShellCommands(plugin: DashboardPlugin): void {
	plugin.addCommand({
		id: 'open-browser',
		nameKey: 'browser.open',
		name: t('browser.open'),
		callback: () => {
			void plugin.openBrowser({});
		},
	});
	plugin.addCommand({
		id: 'open-automations',
		nameKey: 'automation.openAutomations',
		name: t('automation.openAutomations'),
		callback: () => {
			void plugin.automationHost?.open();
		},
	});
	plugin.addCommand({
		id: 'open-notifications',
		nameKey: 'automation.openNotifications',
		name: t('automation.openNotifications'),
		callback: () => plugin.automationHost?.inbox(),
	});
	plugin.addCommand({
		id: 'new-automation',
		nameKey: 'automation.new',
		name: t('automation.new'),
		callback: () => plugin.automationHost?.edit(),
	});
	plugin.addCommand({
		id: 'open-contacts',
		nameKey: 'contacts.open',
		name: t('contacts.open'),
		callback: () => {
			void plugin.openContacts();
		},
	});
	plugin.addCommand({
		id: NAND_COMMANDS.OPEN_DASHBOARD,
		nameKey: 'main.openDashboard',
		name: t('main.openDashboard'),
		callback: () => {
			void plugin.openDashboard();
		},
	});
	plugin.addCommand({
		id: NAND_COMMANDS.OPEN_EDITOR_VIEW,
		nameKey: 'editor.openPanel',
		name: t('editor.openPanel'),
		callback: () => {
			void plugin.openEditorView();
		},
	});
}
