// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import type { ModuleManifest } from '../../app/contracts/module';
import { NAVIGATOR_LISTS, NAVIGATOR_PANEL } from './api';

export const navigatorManifest: ModuleManifest = {
	id: 'navigator',
	order: 35,
	icon: 'notebook-tabs',
	titleKey: 'modules.navigator',
	descriptionKey: 'modules.navigatorDesc',
	platforms: { desktop: true, mobile: true },
	defaultEnabled: true,
	activation: 'startup',
	provides: [NAVIGATOR_PANEL, NAVIGATOR_LISTS],
	load: () => import('./module'),
};
