import type { AgentDispatch, AgentDispatchReceipt } from '../../agent/api';
import type { SkillShortcut } from '../core/board/types/model';
import { planSkillDispatch, SkillPromptError } from '../core/board/skill-prompt';
import { t } from '../../../shared/i18n';

import type { SkillContext } from '../core/skills/context';
export type { SkillContext } from '../core/skills/context';
export interface SkillDraft { finalPrompt: string; files: string[]; destination: SkillShortcut['destination']; }
export function skillPrompt(skill: SkillShortcut, variables: Readonly<Record<string, string>>): string {
	return planSkillDispatch({ agent: skill.agentId, skill: skill.skillName, template: skill.promptTemplate, vars: variables }).prompt;
}
export function skillError(error: unknown): string {
	if (error instanceof SkillPromptError) return t(error.code === 'invalid-skill' ? 'quickActions.skillInvalid' : 'quickActions.skillUnsupported');
	const code = typeof error === 'string' ? error : error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
	if (code === 'timeout') return t('quickActions.skillTimeout');
	const keys: Record<string, string> = { missing: 'home.skills.sessionMissing', targetChanged: 'home.skills.sessionMissing', busy: 'home.skills.busy', cancelled: 'home.skills.cancelled', unsupported: 'quickActions.skillUnsupported' };
	if (keys[code]) return t(keys[code]);
	const translated = t(`automation.${code}`);
	return translated === `automation.${code}` ? t('quickActions.skillUnavailable') : translated;
}

/** Capture a click once. Preview owns the final draft, which is never regenerated on confirmation. */
export async function dispatchSkillShortcut(skill: SkillShortcut, context: SkillContext, ports: {
	dispatch(): Promise<AgentDispatch | undefined>;
	preview(skill: SkillShortcut, context: SkillContext, draft: SkillDraft): Promise<SkillDraft | null>;
	notify(message: string): void;
	signal?: AbortSignal;
}): Promise<AgentDispatchReceipt | undefined> {
	const snapshot = structuredClone(skill);
	const captured = structuredClone(context);
	try {
		const draft: SkillDraft = { finalPrompt: skillPrompt(snapshot, captured.variables), files: [...captured.files], destination: { ...snapshot.destination } };
		const dispatch = await ports.dispatch();
		if (ports.signal?.aborted) return;
		if (!dispatch) { ports.notify(t('quickActions.skillUnavailable')); return; }
		const final = snapshot.directSend ? draft : await ports.preview(snapshot, captured, draft);
		if (!final || ports.signal?.aborted) return;
		const receipt = await dispatch.dispatch({ invocationId: crypto.randomUUID(), title: snapshot.label, source: captured.source, agentId: snapshot.agentId, ...final }, { signal: ports.signal });
		if (ports.signal?.aborted) return receipt;
		ports.notify(receipt.delivery === 'pasted' ? t('home.skills.pasted') : receipt.delivery === 'started' ? t('home.skills.started') : skillError(receipt.errorCode ?? receipt.delivery));
		return receipt;
	} catch (error) { if (!ports.signal?.aborted) ports.notify(skillError(error)); return; }
}
