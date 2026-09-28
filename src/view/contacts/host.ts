import type { ContactsController } from '../../platform/obsidian/contacts/controller';
import type { AutomationUiPort } from '../../shared/automation/types';
import type { ContactsSettings } from '../../shared/contacts-settings';

export interface ContactsHost {
	settings: { contacts: ContactsSettings; modules: { contacts: boolean } };
	contactsHost?: ContactsController;
	automationHost?: AutomationUiPort;
}
