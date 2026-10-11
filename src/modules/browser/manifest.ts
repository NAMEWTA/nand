import type { ModuleManifest } from '../../app/contracts/module';
import { BROWSER_AGENT_BRIDGE, BROWSER_ASSISTANT, BROWSER_CONTROL, BROWSER_OPEN, BROWSER_PROFILES, BROWSER_WORKSPACE } from './api';
import { AGENT_RUN_CONTEXTS } from '../agent/api';
import { BROWSER_WORKFLOWS, BROWSER_EXTERNAL_ACCESS } from './api';
import { AUTOMATION_SOURCES, AUTOMATION_WORKFLOW_RUNNERS } from '../automations/api';

export const browserManifest: ModuleManifest = {
	id: 'browser',
	order: 10,
	icon: 'globe',
	titleKey: 'browser.title',
	descriptionKey: 'browser.description',
	platforms: { desktop: true, mobile: true },
	defaultEnabled: true,
	activation: 'startup',
	provides: [BROWSER_OPEN, BROWSER_AGENT_BRIDGE, BROWSER_PROFILES, BROWSER_CONTROL, BROWSER_WORKSPACE, BROWSER_ASSISTANT, BROWSER_WORKFLOWS, BROWSER_EXTERNAL_ACCESS],
	contributes: [AGENT_RUN_CONTEXTS, AUTOMATION_WORKFLOW_RUNNERS, AUTOMATION_SOURCES],
	load: () => import('./module'),
};
