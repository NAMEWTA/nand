import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { registerMessages } from '../../shared/i18n/index';
import { AUTOMATION_AGENT_RUNTIME } from '../automations/api';
import { AGENT_DISPATCH, AGENT_PROMPT_RUNNER, AGENT_SESSIONS, AGENT_WORKBENCH } from './api';
import { messages } from './i18n';
import { messages as automationStrings } from '../../shared/i18n/lazy/automation';
import { messages as commonStrings } from '../../shared/i18n/lazy/common';
import type { AgentController } from './services/controller';
import { createAgentDispatch, createPromptRunner } from './services/prompt-port';
import { sessionMaterialPort } from './services/session-material';
import { agentWorkbench } from './services/workbench';
import { agentSettings } from './settings';

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
	return {
		/** Read after `activate()`. */
		get services() {
			const current = controller;
			return current
				? [
						[AUTOMATION_AGENT_RUNTIME, current.runtime] as const,
						[AGENT_SESSIONS, sessionMaterialPort(current)] as const,
						[AGENT_WORKBENCH, agentWorkbench(current)] as const,
						[AGENT_PROMPT_RUNNER, createPromptRunner({ run: (request) => current.runPrompt(request) })] as const,
						[AGENT_DISPATCH, createAgentDispatch({ openShell: () => current.newShell(), paste: (id, text) => current.pasteInto(id, text) })] as const,
					]
				: [];
		},
		pages: {
			terminal: async () => (await import('./ui/terminal/agent-page')).createAgentPage(() => controller),
		},
		settingsPage: async () => (await import('./ui/settings-page')).agentSettingsPage(() => controller),
		async activate() {
			const { AgentController } = await import('./services/controller');
			controller = new AgentController(context, settings, {
				confirm: async (app, message) => (await import('./ui/terminal/confirm')).confirmAction(app, message),
				switchSession: (current) => void import('./ui/terminal/session-switcher').then(({ openSessionSwitcher }) => openSessionSwitcher(current)),
			});
			controller.registerCommands();
		},
		async dispose() {
			const current = controller;
			controller = undefined;
			await current?.dispose();
		},
	};
}
