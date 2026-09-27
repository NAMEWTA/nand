import { NAND_COMMANDS } from '../shared/commands';
import { t } from '../shared/i18n';
import type DashboardPlugin from './main';

/** Shell commands. Products register their own commands from their host. */
export function registerShellCommands(plugin: DashboardPlugin): void {
	plugin.addCommand({ id: 'open-automations', name: t('automation.title'), callback: () => { void plugin.automationHost?.open(); } });
	plugin.addCommand({ id: 'open-notifications', name: t('automation.inbox'), callback: () => plugin.automationHost?.inbox() });
	plugin.addCommand({ id: 'new-automation', name: t('automation.new'), callback: () => plugin.automationHost?.edit() });
	plugin.addCommand({ id: 'open-contacts', name: t('contacts.open'), callback: () => { void plugin.openContacts(); } });
	plugin.addCommand({
		id: NAND_COMMANDS.OPEN_DASHBOARD,
		name: t('main.openDashboard'),
		callback: () => {
			void plugin.openDashboard();
		},
	});
	plugin.addCommand({
		id: NAND_COMMANDS.OPEN_EDITOR_VIEW,
		name: t('editor.openPanel'),
		callback: () => {
			void plugin.openEditorView();
		},
	});
}
