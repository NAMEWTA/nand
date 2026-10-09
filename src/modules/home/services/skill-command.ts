import { t } from '../../../shared/i18n';
import type { AgentDispatch } from '../../agent/api';
import { planSkillDispatch } from '../core/board/skill-prompt';

/** One skill template, then one new session or one paste. Enter stays up and success is not reported. */
export async function runSkillCommand(
	target: string,
	acquire: () => Promise<AgentDispatch | undefined>,
	notify: (message: string) => void,
	sessionId?: string,
): Promise<{ submitted: false } | undefined> {
	const [kind, agent, skill] = target.split(':');
	if (kind !== 'skill' || !agent || !skill) return undefined;
	const plan = planSkillDispatch({ agent, skill, template: '', vars: {}, sessionId });
	const dispatch = await acquire();
	if (!dispatch) {
		notify(t('quickActions.skillUnavailable'));
		return undefined;
	}
	if (plan.mode === 'paste' && plan.sessionId) return dispatch.paste(plan.sessionId, plan.prompt);
	return dispatch.start(plan.prompt);
}
