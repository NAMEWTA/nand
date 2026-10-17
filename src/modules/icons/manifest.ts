import type { ModuleManifest } from '../../app/contracts/module';
import { ICONS_SERVICE } from './api';

export const iconsManifest: ModuleManifest = {
	id: 'icons',
	order: 60,
	icon: 'images',
	titleKey: 'modules.iconic',
	descriptionKey: 'modules.iconicDesc',
	platforms: { desktop: true, mobile: true },
	defaultEnabled: true,
	activation: 'startup',
	provides: [ICONS_SERVICE],
	load: () => import('./module'),
};
