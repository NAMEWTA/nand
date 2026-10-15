// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/automation-templates.ts
export interface AutomationTemplate {
	id: string;
	kind: 'agent' | 'notify';
	expression: string;
}
export const AUTOMATION_TEMPLATES: readonly AutomationTemplate[] = [
	{ id: 'daily-notes', kind: 'agent', expression: '0 9 * * *' },
	{ id: 'weekly-review', kind: 'agent', expression: '0 18 * * 5' },
	{ id: 'broken-links', kind: 'agent', expression: '0 10 * * 1' },
	{ id: 'inbox', kind: 'agent', expression: '0 17 * * 1-5' },
	{ id: 'water', kind: 'notify', expression: '0 * * * *' },
];
