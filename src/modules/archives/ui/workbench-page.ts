import type { PageCreate } from '../../../app/contracts/workbench-host';
import { ContactsPresentation } from './contacts-presentation';
import type { ContactsHost } from '../services/page-host';
import { navigateContacts } from './navigate';

/** Archives page: people and companies with list/detail. */
export const createArchivesPage = (host: () => ContactsHost): PageCreate => async (context) => {
	const surface = new ContactsPresentation(context, host());
	return { surface, getTarget: () => surface.getTarget(), navigate: (target, signal) => navigateContacts(surface, target, signal) };
};
