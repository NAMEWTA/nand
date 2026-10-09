import type { ModuleManifest } from '../../app/contracts/module';
import { AUTOMATION_SOURCES } from '../automations/api';

export const archivesManifest: ModuleManifest = {
	id: 'archives',
	order: 40,
	icon: 'contact-round',
	titleKey: 'contacts.title',
	descriptionKey: 'contacts.description',
	platforms: { desktop: true, mobile: true },
	defaultEnabled: true,
	activation: 'startup',
	contributes: [AUTOMATION_SOURCES],
	load: () => import('./module'),
};
