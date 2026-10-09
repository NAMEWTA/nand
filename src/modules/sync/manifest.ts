import type { ModuleManifest } from '../../app/contracts/module';
import { SYNC_WORKBENCH } from './api';

/** Git sync of the vault with the system git. Off by default: it starts processes and talks to a remote. */
export const syncManifest: ModuleManifest = {
	id: 'sync',
	order: 90,
	icon: 'git-branch',
	titleKey: 'workbench.sync',
	descriptionKey: 'modules.syncDesc',
	platforms: { desktop: true, mobile: false },
	defaultEnabled: false,
	activation: 'layout-ready',
	provides: [SYNC_WORKBENCH],
	load: () => import('./module'),
};
