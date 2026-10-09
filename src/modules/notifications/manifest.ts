import type { ModuleManifest } from '../../app/contracts/module';
import { NOTIFICATION_INBOX } from './api';

export const notificationsManifest: ModuleManifest = {
	id: 'notifications',
	order: 70,
	icon: 'bell',
	titleKey: 'workbench.notifications',
	descriptionKey: 'modules.notificationsDesc',
	platforms: { desktop: true, mobile: true },
	defaultEnabled: true,
	activation: 'startup',
	provides: [NOTIFICATION_INBOX],
	load: () => import('./module'),
};
