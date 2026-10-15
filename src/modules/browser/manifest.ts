import type { ModuleManifest } from '../../app/contracts/module';
import { BROWSER_HOST, BROWSER_OPEN, BROWSER_PROFILES } from './api';

export const browserManifest: ModuleManifest = {
	id: 'browser',
	order: 10,
	icon: 'globe',
	titleKey: 'browser.title',
	descriptionKey: 'browser.description',
	platforms: { desktop: true, mobile: false },
	defaultEnabled: true,
	activation: 'startup',
	provides: [BROWSER_HOST, BROWSER_OPEN, BROWSER_PROFILES],
	load: () => import('./module'),
};
