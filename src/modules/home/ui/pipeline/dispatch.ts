import { Notice } from 'obsidian';
import type { DashboardSurface } from '../view/dashboard-surface';
import { PipelineVault } from '../../platform/pipeline/vault';
import { resolvePipelineSkill } from '../../services/pipeline';
import { dispatchSkillShortcut } from '../../services/skill-shortcuts';
import { homeServices } from '../../services/instances';
import { previewSkill } from '../skills/AgentPromptPanel';
import { t } from '../../../../shared/i18n';

export async function runPipelineSkill(surface: DashboardSurface, columnName: string, skillId: string, stageId: string, path?: string, input?: string, signal?: AbortSignal): Promise<void> {
	if (!surface.isOpen || signal?.aborted) return;
	const column = surface.data?.columns.find(column => column.name === columnName), config = column?.pipelineConfig;
	const skill = config?.skills.find(skill => skill.id === skillId);
	if (!column || !config || !skill) throw new Error(t('home.pipeline.contextChanged'));
	const key = `pipeline:${column.id ?? columnName}:${skillId}:${stageId}:${path ?? ''}`;
	if (surface.agentDeliveries.has(key)) return;
	const abort = new AbortController(); surface.agentDeliveries.set(key, abort);
	const closed = () => abort.abort();
	signal?.addEventListener('abort', closed, { once: true });
	try {
		const board = surface.plugin.settings.dashboardFile;
		const context = await resolvePipelineSkill(new PipelineVault(surface.app), board.endsWith('.md') ? board : `${board}.md`, column.id ?? column.name, config, skill, stageId, path, input, abort.signal);
		await dispatchSkillShortcut(skill, context, {
			dispatch: homeServices.acquireDispatch ?? (async () => undefined), signal: abort.signal,
			preview: (skill, ctx, initial) => previewSkill(surface.app, skill, ctx, initial, abort.signal, surface),
			notify: message => { if (!abort.signal.aborted) new Notice(message); },
		});
	} finally { signal?.removeEventListener('abort', closed); if (surface.agentDeliveries.get(key) === abort) surface.agentDeliveries.delete(key); }
}
