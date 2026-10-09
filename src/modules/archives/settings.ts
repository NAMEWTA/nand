import { domainSettings } from '../../shared/settings/schema';
import { DEFAULT_CONTACTS_SETTINGS, normalizeContactsSettings, type ContactsSettings } from '../../shared/contacts-settings';

/** Settings namespace `archives`. */
export const archivesSettings = domainSettings<ContactsSettings>({
	defaults: () => ({ ...DEFAULT_CONTACTS_SETTINGS, layouts: {} }),
	normalize: normalizeContactsSettings,
});
