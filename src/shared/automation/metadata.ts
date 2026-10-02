import type { AutomationDefinition } from './types';

export function isDefinition(value: unknown): value is AutomationDefinition {
	if (!value || typeof value !== 'object') return false;
	const d = value as Partial<AutomationDefinition>;
	if (!(
		typeof d.id === 'string' &&
		!!d.id &&
		typeof d.name === 'string' &&
		typeof d.deviceId === 'string' &&
		typeof d.enabled === 'boolean' &&
		Number.isFinite(d.revision) &&
		Number.isFinite(d.graceMinutes) &&
		d.graceMinutes! >= 0 &&
		!!d.schedule &&
		!!d.action &&
		Array.isArray(d.channels) &&
		d.channels.every((c) => ['in-app', 'system', 'email', 'sms'].includes(c)) &&
		['always', 'failure', 'never'].includes(d.notifyOn ?? '') &&
		Number.isFinite(d.createdAt) &&
		Number.isFinite(d.updatedAt)
	))
		return false;
	const schedule = d.schedule;
	if (!(
		schedule.kind === 'manual' ||
		(schedule.kind === 'once' && Number.isFinite(schedule.at)) ||
		(schedule.kind === 'recurring' && Number.isFinite(schedule.start) && typeof schedule.expression === 'string')
	))
		return false;
	const action = d.action;
	if (action.kind === 'script') return typeof action.script === 'string' && typeof action.cwd === 'string' && ['powershell', 'bash'].includes(action.shell);
	if (action.kind === 'open-file') return typeof action.path === 'string' && !!action.path;
	if (action.kind === 'open-url') { try { return ['http:', 'https:'].includes(new URL(action.url).protocol); } catch { return false; } }
	if (action.kind === 'obsidian-command') return typeof action.command === 'string' && !!action.command;
	if (action.kind === 'notify') return typeof action.body === 'string';
	if (action.kind === 'create-task')
		return typeof action.text === 'string' && typeof action.path === 'string' && typeof action.cardId === 'string';
	if (
		action.kind !== 'agent' ||
		typeof action.agentId !== 'string' ||
		typeof action.prompt !== 'string' ||
		typeof action.cwd !== 'string' ||
		!['fresh', 'reuse', 'specific'].includes(action.sessionMode)
	)
		return false;
	const session = action.session;
	return (
		action.sessionMode !== 'specific' ||
		(!!session &&
			typeof session.sessionId === 'string' &&
			typeof session.agentId === 'string' &&
			typeof session.cwd === 'string' &&
			typeof session.accountKey === 'string')
	);
}
export const TASK_META_REGEX = /\s*<!-- nand-task:([^>]+) -->/;
export interface TaskAutomationMeta {
	id?: string;
	automation?: AutomationDefinition;
	runId?: string;
}
export function readTaskMeta(text: string): TaskAutomationMeta {
	const match = TASK_META_REGEX.exec(text);
	if (!match?.[1]) return {};
	try {
		const value: unknown = JSON.parse(decodeURIComponent(match[1]));
		if (!value || typeof value !== 'object') return {};
		const m = value as TaskAutomationMeta;
		return {
			id: typeof m.id === 'string' ? m.id : undefined,
			runId: typeof m.runId === 'string' ? m.runId : undefined,
			automation: isDefinition(m.automation) ? m.automation : undefined,
		};
	} catch {
		return {};
	}
}
export function taskMetaSuffix(meta: TaskAutomationMeta): string {
	if (!meta.id && !meta.automation && !meta.runId) return '';
	return ` <!-- nand-task:${encodeURIComponent(JSON.stringify({ id: meta.id, automation: meta.automation, runId: meta.runId })).replace(/-/g, '%2D')} -->`;
}
