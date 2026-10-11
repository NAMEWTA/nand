import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { registerMessages } from '../../shared/i18n/index';
import { AUTOMATION_AGENT_RUNTIME, AUTOMATION_INVOCATIONS } from '../automations/api';
import { AGENT_DIRECTORY, AGENT_DISPATCH, AGENT_PROMPT_RUNNER, AGENT_SESSIONS, AGENT_SKILLS, AGENT_WORKBENCH } from './api';
import { messages } from './i18n';
import { messages as automationStrings } from '../../shared/i18n/lazy/automation';
import { messages as commonStrings } from '../../shared/i18n/lazy/common';
import type { AgentController } from './services/controller';
import { createAgentDispatch } from './services/prompt-port';
import { sessionMaterialPort } from './services/session-material';
import { agentWorkbench } from './services/workbench';
import { agentSettings } from './settings';
import { AgentSkillDirectory } from './services/skills';

registerMessages(automationStrings);
registerMessages(commonStrings);
registerMessages(messages);

/**
 * Agent module: terminal sessions (shells, coding agents, presets) on the native helper, native history,
 * usage, the automation runtime and agent material. Everything is created per activation and ended on
 * dispose; turning the module off ends every terminal.
 */
export default function createAgentModule(context: ModuleContext): ModuleInstance {
	const settings = context.settings.bind('agent', agentSettings);
	let controller: AgentController | undefined;
	let dispatch: ReturnType<typeof createAgentDispatch> | undefined;
	let skills: AgentSkillDirectory | undefined;
	return {
		/** Read after `activate()`. */
		get services() {
			const current = controller;
			return skills ? [
				[AGENT_SKILLS, skills] as const,
				...(current ? [
						[AUTOMATION_AGENT_RUNTIME, current.runtime] as const,
						[AGENT_SESSIONS, sessionMaterialPort(current)] as const,
						[AGENT_WORKBENCH, agentWorkbench(current)] as const,
						[AGENT_PROMPT_RUNNER, current.prompts] as const,
						[AGENT_DIRECTORY, { list: () => current.runtime.listAgents() }] as const,
						[AGENT_DISPATCH, dispatch!] as const,
					] : []),
			] : [];
		},
		pages: {
			terminal: async () => (await import('./ui/terminal/agent-page')).createAgentPage(() => controller),
		},
		settingsPage: async () => (await import('./ui/settings-page')).agentSettingsPage(() => controller, settings, context.env.desktop),
		async activate() {
			skills = new AgentSkillDirectory(context.app.vault.adapter, settings, context.env.desktop);
			// Portable discovery never imports the terminal controller or its desktop dependency tree.
			if (!context.env.desktop) return;
			const { AgentController } = await import('./services/controller');
			controller = new AgentController(context, settings, {
				confirm: async (app, message) => (await import('./ui/terminal/confirm')).confirmAction(app, message),
				switchSession: (current) => void import('./ui/terminal/session-switcher').then(({ openSessionSwitcher }) => openSessionSwitcher(current)),
			});
			controller.registerCommands();
			const current = controller;
			dispatch = createAgentDispatch({ agents: () => current.runtime.listAgents(), invocations: () => context.services.peek(AUTOMATION_INVOCATIONS),
				cwd: () => current.vaultPath() ?? '', clock: context.app.workspace.containerEl.win });
		},
		async dispose() {
			skills?.dispose(); skills = undefined;
			dispatch?.dispose(); dispatch = undefined;
			const current = controller;
			controller = undefined;
			await current?.dispose();
		},
	};
}
