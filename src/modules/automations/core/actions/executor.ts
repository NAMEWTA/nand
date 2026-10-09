import type { AutomationAction, AutomationRun, AgentRunHandle } from '../../../../shared/automation/types';

export interface ActionRef {
	definitionId: string;
	name?: string;
	icon?: string;
}
export interface ActionDescriptor {
	kind: AutomationAction['kind'];
	name: string;
	manual: boolean;
	scheduled: boolean;
	desktop: boolean;
	unavailableReason?: string;
}
export const actionDescriptors: readonly ActionDescriptor[] = [
	{ kind: 'agent', name: 'automation.agent', manual: true, scheduled: true, desktop: true },
	{ kind: 'script', name: 'automation.script', manual: true, scheduled: true, desktop: true },
	{ kind: 'create-task', name: 'automation.create-task', manual: true, scheduled: true, desktop: false },
	{ kind: 'notify', name: 'automation.notify', manual: true, scheduled: true, desktop: false },
	{ kind: 'obsidian-command', name: 'automation.obsidian-command', manual: true, scheduled: false, desktop: false },
	{ kind: 'open-file', name: 'automation.open-file', manual: true, scheduled: false, desktop: false },
	{ kind: 'open-url', name: 'automation.open-url', manual: true, scheduled: false, desktop: false },
];
export interface ActionResult {
	message: string;
	handle?: AgentRunHandle;
}
export interface ActionContext {
	run: AutomationRun;
	desktop: boolean;
}
export interface ActionExecutor {
	execute(action: AutomationAction, context: ActionContext): Promise<ActionResult>;
}
export function actionAvailability(
	kind: AutomationAction['kind'],
	trigger: 'manual' | 'scheduled',
	desktop: boolean,
): string | undefined {
	const descriptor = actionDescriptors.find((d) => d.kind === kind);
	if (!descriptor) return 'automation.invalid';
	if (trigger === 'scheduled' && !descriptor.scheduled) return 'automation.manualOnly';
	if (descriptor.desktop && !desktop) return 'automation.desktopOnly';
	return undefined;
}
