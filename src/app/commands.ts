import { Notice } from 'obsidian';
import { NAND_COMMANDS } from '../shared/commands';
import { t } from '../shared/i18n/index';
import type { ModuleId } from './contracts/module';
import type DashboardPlugin from './main';

/**
 * Shell commands. A command that belongs to a module is only offered while that module is active
 * (`checkCallback`), so turning a module off removes its commands from the palette.
 */
export function registerShellCommands(plugin: DashboardPlugin): void {
	const report = (error: unknown): void => { console.error('[NAND command]', error); new Notice(error instanceof Error ? error.message : String(error)); };
	const when = (module: ModuleId, run: () => void) => (checking: boolean): boolean => {
		if (plugin.moduleState(module) !== 'active') return false;
		if (!checking) run();
		return true;
	};
	plugin.addCommand({ id: 'open-workbench', nameKey: 'workbench.open', name: t('workbench.open'), callback: () => { void plugin.openWorkbench().catch(report); } });
	plugin.addCommand({ id: 'open-browser', nameKey: 'browser.open', name: t('browser.open'), checkCallback: when('browser', () => { void plugin.openBrowser({}).catch(report); }) });
	plugin.addCommand({ id: 'open-automations', nameKey: 'automation.openAutomations', name: t('automation.openAutomations'), checkCallback: when('automations', () => { void plugin.automationHost?.open().catch(report); }) });
	plugin.addCommand({ id: 'open-notifications', nameKey: 'automation.openNotifications', name: t('automation.openNotifications'), checkCallback: when('notifications', () => { void plugin.openWorkbench({ feature: 'notifications' }).catch(report); }) });
	plugin.addCommand({ id: 'new-automation', nameKey: 'automation.new', name: t('automation.new'), checkCallback: when('automations', () => plugin.automationHost?.edit()) });
	plugin.addCommand({ id: 'open-contacts', nameKey: 'contacts.open', name: t('contacts.open'), checkCallback: when('archives', () => { void plugin.openContacts().catch(report); }) });
	plugin.addCommand({ id: NAND_COMMANDS.OPEN_EDITOR_VIEW, nameKey: 'editor.openPanel', name: t('editor.openPanel'), checkCallback: when('comments', () => { void plugin.openEditorView().catch(report); }) });
	plugin.addCommand({
		id: 'cycle-theme',
		nameKey: 'main.cycleTheme',
		name: t('main.cycleTheme'),
		callback: () => { void plugin.cycleThemePreset().catch(report); },
	});
}
