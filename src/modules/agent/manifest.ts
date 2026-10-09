import type { ModuleManifest } from '../../app/contracts/module';
import { AUTOMATION_AGENT_RUNTIME } from '../automations/api';
import { AGENT_SESSIONS, AGENT_WORKBENCH } from './api';

export const agentManifest: ModuleManifest = {
	id: 'agent',
	order: 50,
	icon: 'terminal',
	titleKey: 'modules.terminal',
	descriptionKey: 'modules.terminalDesc',
	platforms: { desktop: true, mobile: false },
	defaultEnabled: true,
	activation: 'startup',
	provides: [AUTOMATION_AGENT_RUNTIME, AGENT_SESSIONS, AGENT_WORKBENCH],
	load: () => import('./module'),
};
