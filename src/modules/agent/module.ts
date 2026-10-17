import type { ModuleContext, ModuleInstance } from '../../app/contracts/module';
import { registerMessages } from '../../shared/i18n/index';
import { AUTOMATION_AGENT_RUNTIME, AUTOMATION_INVOCATIONS } from '../automations/api';
import {
	AGENT_DIRECTORY,
	NATIVE_HELPER_SQLITE,
	AGENT_BROWSER_TABS,
	AGENT_DISPATCH,
	AGENT_PROMPT_RUNNER,
	AGENT_SESSIONS,
	AGENT_SKILLS,
	AGENT_WORKBENCH,
	AGENT_USAGE,
	AGENT_QUICK_COMMANDS,
} from './api';
import { messages } from './i18n';
import { messages as automationStrings } from '../../shared/i18n/lazy/automation';
import { messages as commonStrings } from '../../shared/i18n/lazy/common';
import type { AgentController } from './services/controller';
import { createAgentDispatch } from './services/prompt-port';
import { quickCommandsPort } from './services/quick-commands-port';
import { sessionMaterialPort } from './services/session-material';
import { agentWorkbench } from './services/workbench';
import { cookieClient } from './platform/desktop/server/cookie-client';
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
	const migrationLifetime = new AbortController();
	let releaseMigration: (() => void) | undefined;
	return {
		/** Read after `activate()`. */
		get services() {
			const current = controller;
			return skills
				? [
						[AGENT_SKILLS, skills] as const,
						...(current
							? [
									[AUTOMATION_AGENT_RUNTIME, current.runtime] as const,
									[AGENT_SESSIONS, sessionMaterialPort(current)] as const,
 [AGENT_BROWSER_TABS, {
  sessionOrder: (pageId:string) => {const state=current.workspace.store.getState();const tab=Object.values(state.tabs).find(t=>t.kind==='browser'&&t.pageId===pageId);const group=tab?current.workspace.group(tab.id):undefined;return (group?.tabIds??[]).flatMap(id=>{const t=state.tabs[id];return t?.kind==='terminal'?t.sessionIds:[];});},
  open: async (url?:string,profileId?:string,reuse?:boolean) => {
   await current.workspace.persistence.ready;
   const found=reuse?Object.values(current.workspace.store.getState().tabs).find(tab=>tab.kind==='browser'&&tab.url===url&&(!profileId||tab.profileId===profileId)):undefined;
   if(found)current.workspace.activate(found.id);else current.workspace.newBrowser(url,{profileId});
   await context.shell.open({feature:'terminal'});
   const tab=current.workspace.active;return tab?.kind==='browser'?tab.pageId:'';
  },
  close: async (id:string) => {const tab=Object.values(current.workspace.store.getState().tabs).find(tab=>tab.kind==='browser'&&tab.pageId===id);if(tab)await current.workspace.close(tab.id,async()=>true);},
  list: () => Object.values(current.workspace.store.getState().tabs).flatMap(tab=>tab.kind==='browser'?[{id:tab.pageId,title:tab.title,url:tab.url,profileId:tab.profileId}]:[]),
  activate: (id:string) => {const tab=Object.values(current.workspace.store.getState().tabs).find(tab=>tab.kind==='browser'&&tab.pageId===id);if(tab)current.workspace.activate(tab.id);},
 }] as const,
                                    [NATIVE_HELPER_SQLITE, cookieClient(() => current.sessions.ensureHelper())] as const,
									[AGENT_WORKBENCH, agentWorkbench(current)] as const,
									[AGENT_USAGE, current.usageStore] as const,
									[AGENT_PROMPT_RUNNER, current.prompts] as const,
									[AGENT_DIRECTORY, { list: () => current.runtime.listAgents() }] as const,
									[AGENT_DISPATCH, dispatch!] as const,
									[AGENT_QUICK_COMMANDS, quickCommandsPort(current, settings)] as const,
								]
							: []),
					]
				: [];
		},
		pages: {
			terminal: async () => (await import('./ui/workbench-page')).createAgentPage(() => controller),
		},
		settingsPage: async () =>
			(await import('./ui/settings-page')).agentSettingsPage(() => controller, settings, context.env.desktop),
		async activate() {
			skills = new AgentSkillDirectory(context.app.vault.adapter, settings, context.env.desktop);
			// Portable discovery never imports the terminal controller or its desktop dependency tree.
			if (!context.env.desktop) return;
			const { prepareAccounts } = await import('./platform/desktop/agents/prepare-accounts');
			releaseMigration = await prepareAccounts(context.app, context.manifest.dir ?? '', async (options) =>
				(await import('./ui/terminal/legacy-account-choice')).chooseLegacyAccount(
					context.app,
					options,
					migrationLifetime.signal,
				),
			);
			if (migrationLifetime.signal.aborted) {
				releaseMigration();
				releaseMigration = undefined;
				return;
			}
			const { AgentController } = await import('./services/controller');
			controller = new AgentController(context, settings, {
				confirm: async (app, message) =>
					(await import('./ui/terminal/confirm')).confirmAction(app, message, migrationLifetime.signal),
			});
			await controller.workspace.persistence.ready;
			controller.registerCommands();
			const current = controller;
			dispatch = createAgentDispatch({
				agents: () => current.runtime.listAgents(),
				invocations: () => context.services.peek(AUTOMATION_INVOCATIONS),
				cwd: () => current.vaultPath() ?? '',
				clock: context.app.workspace.containerEl.win,
			});
		},
		async dispose() {
			migrationLifetime.abort();
			releaseMigration?.();
			releaseMigration = undefined;
			skills?.dispose();
			skills = undefined;
			dispatch?.dispose();
			dispatch = undefined;
			const current = controller;
			controller = undefined;
			await current?.dispose();
		},
	};
}
