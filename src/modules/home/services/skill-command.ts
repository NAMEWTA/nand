import { t } from '../../../shared/i18n';
import type { AgentDispatch, AgentDispatchReceipt, AgentDispatchRequest } from '../../agent/api';
import { planSkillDispatch, SkillPromptError } from '../core/board/skill-prompt';
import { skillError } from './skill-shortcuts';

/** Build a draft once. Only the user's confirmed final text goes to the journal-backed dispatcher. */
export async function runSkillCommand(
	target: string,
	acquire: () => Promise<AgentDispatch | undefined>,
	notify: (message: string) => void,
	options: { source: AgentDispatchRequest['source']; preview: (prompt: string, agent: string) => Promise<string | null>; sessionId?: string; signal?: AbortSignal },
): Promise<AgentDispatchReceipt | undefined> {
	const [kind, agent, ...name] = target.split(':');
	const skill = name.join(':');
	if (kind !== 'skill' || !agent || !skill) return undefined;
	let plan;
	try { plan = planSkillDispatch({ agent, skill, template: '', vars: {}, sessionId: options.sessionId }); }
	catch (error) {
		if (!(error instanceof SkillPromptError)) throw error;
		notify(t(error.code === 'invalid-skill' ? 'quickActions.skillInvalid' : 'quickActions.skillUnsupported'));
		return undefined;
	}
	const dispatch = await acquire();
	if (options.signal?.aborted) return undefined;
	if (!dispatch) {
		notify(t('quickActions.skillUnavailable'));
		return undefined;
	}
	const finalPrompt = await options.preview(plan.prompt, agent);
	if (finalPrompt === null || options.signal?.aborted) return undefined;
	const receipt = await dispatch.dispatch({ invocationId: crypto.randomUUID(), title: skill, source: options.source, agentId: agent,
		destination: plan.mode === 'paste' && plan.sessionId ? { kind: 'existing', sessionId: plan.sessionId } : { kind: 'fresh', cwd: '' },
		finalPrompt, files: [] }, { signal: options.signal });
	if (receipt.delivery === 'timeout') notify(t('quickActions.skillTimeout'));
	else if (receipt.delivery === 'rejected') notify(skillError(receipt.errorCode));
	return receipt;
}
