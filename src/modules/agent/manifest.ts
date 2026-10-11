import type { ModuleManifest } from '../../app/contracts/module';
import { AUTOMATION_AGENT_RUNTIME } from '../automations/api';
import { AGENT_SESSIONS, AGENT_WORKBENCH, AGENT_DIRECTORY, AGENT_DISPATCH, AGENT_PROMPT_RUNNER, AGENT_SKILLS } from './api';

export const agentManifest: ModuleManifest = {
	id: 'agent',
	order: 50,
	icon: 'terminal',
	titleKey: 'modules.terminal',
	descriptionKey: 'modules.terminalDesc',
	// Mobile activates portable skill discovery only; the terminal page remains desktop-only.
	platforms: { desktop: true, mobile: true },
	defaultEnabled: true,
	activation: 'startup',
	provides: [AUTOMATION_AGENT_RUNTIME, AGENT_SESSIONS, AGENT_WORKBENCH, AGENT_DIRECTORY, AGENT_DISPATCH, AGENT_PROMPT_RUNNER, AGENT_SKILLS],
	load: () => import('./module'),
};
