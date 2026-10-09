import type { ModuleManifest } from '../../app/contracts/module';

export const iconsManifest: ModuleManifest = {
	id: 'icons',
	order: 60,
	icon: 'images',
	titleKey: 'modules.iconic',
	descriptionKey: 'modules.iconicDesc',
	platforms: { desktop: true, mobile: true },
	defaultEnabled: true,
	activation: 'startup',
	load: () => import('./module'),
};
