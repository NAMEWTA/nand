import type { AutomationDefinition, NotificationChannelId } from './types';

const CHANNELS: readonly string[] = ['in-app', 'system'] satisfies NotificationChannelId[];

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
		d.channels.every((c) => CHANNELS.includes(c)) &&
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
	if (action.kind === 'browser-workflow') return isBrowserWorkflowAction(action);
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
export function isBrowserWorkflowAction(value: unknown): boolean {
	if (!value || typeof value !== 'object') return false;
	const a = value as Record<string, unknown>;
	const id = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,100}$/.test(v);
	return Object.keys(a).every(k => ['kind', 'workflowId', 'version', 'variables', 'scope'].includes(k)) && a.kind === 'browser-workflow'
		&& id(a.workflowId) && Number.isSafeInteger(a.version) && (a.version as number) > 0
		&& !!a.variables && typeof a.variables === 'object' && !Array.isArray(a.variables) && Object.keys(a.variables).length <= 16
		&& Object.entries(a.variables).every(([name, v]) => /^[A-Za-z_][\w-]{0,63}$/.test(name) && !['__proto__', 'constructor', 'prototype'].includes(name)
			&& (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 16_000)))
		&& Array.isArray(a.scope) && a.scope.length > 0 && a.scope.length <= 8
		&& a.scope.every((s: unknown) => !!s && typeof s === 'object' && Object.keys(s).every(k => ['id', 'pageId', 'profileId'].includes(k))
			&& id((s as Record<string, unknown>).id) && id((s as Record<string, unknown>).pageId) && id((s as Record<string, unknown>).profileId))
		&& new Set(a.scope.map(s => (s as { id: string }).id)).size === a.scope.length;
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
