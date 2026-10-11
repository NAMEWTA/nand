import type { AutomationAction } from '../../../shared/automation/types';

export interface AgentActionDefaults {
	agentId: string;
	cwd: string;
}

export function actionText(action: AutomationAction): string {
	switch (action.kind) {
		case 'browser-workflow': return '';
		case 'agent': return action.prompt;
		case 'notify': return action.body;
		case 'create-task': return action.text;
		case 'script': return action.script;
		case 'open-file': return action.path;
		case 'open-url': return action.url;
		case 'obsidian-command': return action.command;
	}
}
export function setActionText(action: AutomationAction, value: string): void {
	switch (action.kind) {
		case 'agent': action.prompt = value; break;
		case 'notify': action.body = value; break;
		case 'create-task': action.text = value; break;
		case 'script': action.script = value; break;
		case 'open-file': action.path = value; break;
		case 'open-url': action.url = value; break;
		case 'obsidian-command': action.command = value; break;
	}
}

export function switchAutomationAction(
	current: AutomationAction,
	kind: AutomationAction['kind'],
	defaults: AgentActionDefaults,
): AutomationAction {
	if (kind === current.kind) return current;
	if (kind === 'browser-workflow') return { kind, workflowId: '', version: 1, variables: {}, scope: [] };
	const text = actionText(current);
	if (kind === 'script') return { kind, script: text, cwd: defaults.cwd, shell: 'powershell' };
	if (kind === 'open-file') return { kind, path: '' };
	if (kind === 'open-url') return { kind, url: '' };
	if (kind === 'obsidian-command') return { kind, command: '' };
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
