import { DEFAULT_DASHBOARD_SETTINGS, type DashboardSettings } from '../../core/dashboard/types/model';
import { DEFAULT_CONTACTS_SETTINGS, type ContactsSettings } from '../../shared/contacts-settings';
import { DEFAULT_EDITOR_WORKBENCH, type EditorWorkbenchSettings } from '../../shared/editor-workbench';
import type { Language } from '../../shared/i18n';

/** Plugin persistence envelope. Each domain owns its own settings shape. */
export interface NandSettings extends DashboardSettings {
	contacts: ContactsSettings;
	language: Language;
	introSeen: boolean;
	modules: {
		dashboard: boolean;
		editor: boolean;
		terminal: boolean;
		contacts: boolean;
		iconic: boolean;
	};
	editorWorkbench: EditorWorkbenchSettings;
	terminalAgent: Record<string, unknown> | null;
}
export const DEFAULT_SETTINGS: NandSettings = {
	...DEFAULT_DASHBOARD_SETTINGS,
	contacts: { ...DEFAULT_CONTACTS_SETTINGS },
	language: 'zh',
	introSeen: false,
	modules: {
		dashboard: true,
		editor: true,
		terminal: true,
		contacts: true,
		iconic: true,
	},
	editorWorkbench: { ...DEFAULT_EDITOR_WORKBENCH },
	terminalAgent: null,
};
