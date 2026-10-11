import { readSkillShortcuts } from '../board/skill-shortcuts';
import { emptyPipeline, type PipelineConfig } from './model';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** A read projection only. The board document preserves untouched source fields and bytes. */
export function readPipelineConfig(value: unknown): PipelineConfig {
	const raw = record(value), defaults = emptyPipeline();
	const skills = (readSkillShortcuts(raw.skills) ?? []).map(skill => {
		const source = (raw.skills as unknown[]).map(record).find(item => item.id === skill.id)!;
		return { ...skill, scope: source.scope === 'stage' ? 'stage' as const : 'card' as const, stages: strings(source.stages) };
	});
	return {
		rootFolder: text(raw.rootFolder), statusField: text(raw.statusField, defaults.statusField),
		stages: (Array.isArray(raw.stages) ? raw.stages : []).map((item, index) => {
			const stage = record(item);
			return { id: text(stage.id, `stage-${index + 1}`), value: text(stage.value), label: text(stage.label),
				...(text(stage.folder) ? { folder: text(stage.folder) } : {}),
				...(typeof stage.width === 'number' && Number.isFinite(stage.width) ? { width: Math.round(Math.max(220, Math.min(640, stage.width))) } : {}) };
		}),
		excludeFolders: strings(raw.excludeFolders), ...(text(raw.archiveFolder) ? { archiveFolder: text(raw.archiveFolder) } : {}),
		templatePaths: strings(raw.templatePaths),
		sortBy: ['title', 'created', 'due'].includes(text(raw.sortBy)) ? raw.sortBy as PipelineConfig['sortBy'] : 'modified', sortDesc: raw.sortDesc !== false,
		filterFields: strings(raw.filterFields), filters: Object.fromEntries(Object.entries(record(raw.filters)).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
		search: text(raw.search), skills,
	};
}
