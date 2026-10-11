import { render } from 'preact';
import { Notice } from 'obsidian';
import type { HomeWidgetContext } from '../../api';
import { dispatchSkillShortcut } from '../../services/skill-shortcuts';
import { homeServices } from '../../services/instances';
import { SkillWidget } from '../skills/SkillWidget';
import { previewSkill } from '../skills/AgentPromptPanel';
import type { DashboardSurface } from './dashboard-surface';
import { RenderBoundary } from '../../../../ui/primitives/RenderBoundary';
import { buildSkillContext } from '../../core/skills/context';
import { t } from '../../../../shared/i18n';

export function renderBoardSkills(surface: DashboardSurface, container: HTMLElement, context: HomeWidgetContext): void {
	const skills = surface.data?.skills ?? [];
	const pending = new Set<string>();
	render(<RenderBoundary onError={context.reportError}><SkillWidget skills={skills} save={async next => {
		await surface.sync.setBoardSkills(next);
		try { for (const skill of next) await homeServices.skills?.()?.remember(skill.agentId, skill.skillName); }
		catch { new Notice(t('home.skills.rememberFailed')); }
	}} run={async skill => {
		if (context.signal.aborted || pending.has(skill.id)) return;
		pending.add(skill.id);
		try {
			const path = context.boardPath.endsWith('.md') ? context.boardPath : `${context.boardPath}.md`;
			await dispatchSkillShortcut(skill, buildSkillContext({ source: { kind: 'widget', path: context.boardPath, id: skill.id }, path, title: path.split('/').pop()?.replace(/\.md$/i, '') ?? '' }), {
				dispatch: homeServices.acquireDispatch ?? (async () => undefined), signal: context.signal,
				preview: (skill, ctx, initial) => previewSkill(surface.app, skill, ctx, initial, context.signal, surface, true),
				notify: message => { if (!context.signal.aborted) new Notice(message); },
			});
		} finally { pending.delete(skill.id); }
	}} /></RenderBoundary>, container);
	context.register(() => render(null, container));
}
