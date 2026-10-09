import type { ModuleManifest } from '../../app/contracts/module';
import { AUTOMATION_SOURCES } from '../automations/api';

export const homeManifest: ModuleManifest = {
	id: 'home',
	order: 20,
	icon: 'layout-dashboard',
	titleKey: 'modules.dashboard',
	descriptionKey: 'modules.dashboardDesc',
	platforms: { desktop: true, mobile: true },
	defaultEnabled: true,
	activation: 'startup',
	contributes: [AUTOMATION_SOURCES],
	load: () => import('./module'),
};
