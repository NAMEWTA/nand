import type { AutomationAction } from '../../shared/automation/types';

export interface AgentActionDefaults {
	agentId: string;
	cwd: string;
}

function actionText(action: AutomationAction): string {
	return action.kind === 'agent' ? action.prompt : action.kind === 'notify' ? action.body : action.text;
}

export function switchAutomationAction(
	current: AutomationAction,
	kind: AutomationAction['kind'],
	defaults: AgentActionDefaults,
): AutomationAction {
	if (kind === current.kind) return current;
	const text = actionText(current);
	if (kind === 'notify') return { kind: 'notify', body: text };
	if (kind === 'create-task') return { kind: 'create-task', path: '', cardId: '', text };
	return {
		kind: 'agent',
		agentId: defaults.agentId,
		cwd: defaults.cwd,
		prompt: text,
		sessionMode: 'fresh',
	};
}
