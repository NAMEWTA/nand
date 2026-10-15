// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/automation-draft-model.ts
import type { AutomationDefinition, AgentDescription } from '../../../../shared/automation/types';
import type { AutomationEditRequest } from '../../core/api';
import type { AutomationTemplate } from '../../core/templates';
import { systemTimeZone, validateSchedule } from '../../core/schedule';
import { actionText } from '../../core/switch-action';
import { validatedExtraArgs } from '../../../../shared/automation/extra-args';
import { AutomationError } from '../../../../shared/automation/errors';
import { t } from '../../../../shared/i18n';

export const availableAgents = (agents: readonly AgentDescription[]) =>
	agents.filter((agent) => agent.enabled && agent.installed !== false);
export function newDraft(
	request: AutomationEditRequest,
	deviceId: string,
	cwd: string,
	agents: readonly AgentDescription[],
	template?: AutomationTemplate,
): AutomationDefinition {
	if (request.existing) return structuredClone(request.existing);
	const name = template ? t(`automation.template.${template.id}.name`) : (request.title ?? '');
	const prompt = template ? t(`automation.template.${template.id}.prompt`) : (request.title ?? '');
	return {
		id: crypto.randomUUID(),
		name,
		enabled: true,
		deviceId,
		revision: 1,
		schedule: template
			? { kind: 'recurring', expression: template.expression, timezone: systemTimeZone(), start: Date.now() }
			: request.source
				? { kind: 'once', at: Date.now() + 60 * 60 * 1000 }
				: { kind: 'manual' },
		action:
			request.source || template?.kind === 'notify'
				? { kind: 'notify', body: prompt }
				: { kind: 'agent', agentId: availableAgents(agents)[0]?.id ?? '', cwd, prompt, sessionMode: 'fresh' },
		channels: ['in-app'],
		notifyOn: 'always',
		graceMinutes: 720,
		source: request.source,
		templateId: template?.id,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
}
export function draftError(
	draft: AutomationDefinition,
	agents: readonly AgentDescription[],
	cwd: string,
	original?: AutomationDefinition,
): string | undefined {
	if (!draft.name.trim()) return t('automation.nameRequired');
	if (!actionText(draft.action).trim()) return t('automation.contentRequired');
	const action = draft.action;
	if (action.kind === 'agent' || action.kind === 'script') {
		// The picker only supplies vault folders; validate again at the execution boundary (including symlinks).
		const root = cwd.replace(/\\/g, '/').replace(/\/$/, '');
		const target = action.cwd.replace(/\\/g, '/');
		if (!target || target.split('/').includes('..') || (target !== root && !target.startsWith(root + '/')))
			return t('automation.cwdInvalid');
	}
	if (action.kind === 'agent') {
		if (!availableAgents(agents).some((agent) => agent.id === action.agentId))
			return t('automation.agentSelectionUnavailable');
		if (
			action.sessionMode === 'specific' &&
			(!action.session?.sessionId ||
				action.session.agentId !== action.agentId ||
				action.session.cwd !== action.cwd)
		)
			return t('automation.sessionMissing');
		try {
			validatedExtraArgs(action.agentId, action.extraArgs ?? '');
		} catch (error) {
			return error instanceof Error ? error.message : String(error);
		}
		if (action.sessionMode === 'reuse' && action.extraArgs?.trim()) return t('automation.extraArgsReuse');
	}
	if (action.kind === 'create-task' && (!action.path || !action.cardId)) return t('automation.targetRequired');
	if (action.kind === 'open-url') {
		try {
			if (!['http:', 'https:'].includes(new URL(action.url).protocol)) return t('automation.invalid');
		} catch {
			return t('automation.invalid');
		}
	}
	if (action.kind === 'notify' && !draft.channels.length) return t('automation.channelsRequired');
	try {
		validateSchedule(draft.schedule);
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
	if (
		draft.schedule.kind === 'once' &&
		draft.schedule.at <= Date.now() &&
		JSON.stringify(original?.schedule) !== JSON.stringify(draft.schedule)
	)
		return t('automation.pastTime');
	if (draft.graceMinutes < 0 || !Number.isFinite(draft.graceMinutes))
		return new AutomationError('graceInvalid').message;
	return undefined;
}
