import type { ModuleManifest } from '../../app/contracts/module';
import { NOTIFICATION_OPENERS } from '../notifications/api';

export const automationsManifest: ModuleManifest = {
	id: 'automations',
	order: 80,
	icon: 'workflow',
	titleKey: 'automation.title',
	descriptionKey: 'modules.automationDesc',
	platforms: { desktop: true, mobile: true },
	defaultEnabled: true,
	activation: 'startup',
	contributes: [NOTIFICATION_OPENERS],
	load: () => import('./module'),
};
