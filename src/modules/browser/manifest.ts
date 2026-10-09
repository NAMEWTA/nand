import type { ModuleManifest } from '../../app/contracts/module';
import { BROWSER_AGENT_BRIDGE, BROWSER_OPEN } from './api';

export const browserManifest: ModuleManifest = {
	id: 'browser',
	order: 10,
	icon: 'globe',
	titleKey: 'browser.title',
	descriptionKey: 'browser.description',
	platforms: { desktop: true, mobile: true },
	defaultEnabled: true,
	activation: 'startup',
	provides: [BROWSER_OPEN, BROWSER_AGENT_BRIDGE],
	load: () => import('./module'),
};
