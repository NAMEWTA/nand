import { readSkillShortcuts } from '../board/skill-shortcuts';
import { emptyPipeline, type PipelineConfig } from './model';

const record = (value: unknown): Record<string, unknown> =>
	value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const strings = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** A read projection only. The board document preserves untouched source fields and bytes. */
export function readPipelineConfig(value: unknown): PipelineConfig {
	const raw = record(value),
		defaults = emptyPipeline();
	const skills = (
		readSkillShortcuts(
			Array.isArray(raw.skills)
				? raw.skills.map((value) => {
						const skill = record(value);
						return {
							...skill,
							agentId: skill.agentId ?? skill.agent,
							destination: skill.destination ?? { kind: 'fresh', cwd: '' },
						};
					})
				: raw.skills,
		) ?? []
	).map((skill) => {
		const source = (raw.skills as unknown[]).map(record).find((item) => item.id === skill.id)!;
		return {
			...skill,
			scope: source.scope === 'stage' ? ('stage' as const) : ('card' as const),
			stages: strings(source.stages).length
				? strings(source.stages)
				: text(source.stage)
					? [text(source.stage)]
					: [],
		};
	});
	return {
		...(['theme', 'trello', 'solid', 'blush'].includes(text(raw.boardStyle))
			? { boardStyle: raw.boardStyle as PipelineConfig['boardStyle'] }
			: {}),
		...(Array.isArray(raw.cardProperties) ? { cardProperties: strings(raw.cardProperties) } : {}),
		rootFolder: text(raw.rootFolder),
		statusField: text(raw.statusField, defaults.statusField),
		stages: (Array.isArray(raw.stages) ? raw.stages : []).map((item, index) => {
			const stage = record(item);
			return {
				id: text(stage.id, `stage-${index + 1}`),
				...(text(stage.color) ? { color: text(stage.color) } : {}),
				value: text(stage.value),
				label: text(stage.label),
				...(text(stage.folder) ? { folder: text(stage.folder) } : {}),
				...(typeof stage.width === 'number' && Number.isFinite(stage.width)
					? { width: Math.round(Math.max(220, Math.min(640, stage.width))) }
					: {}),
			};
		}),
		excludeFolders: strings(raw.excludeFolders),
		...(text(raw.archiveFolder) ? { archiveFolder: text(raw.archiveFolder) } : {}),
		templatePaths: strings(raw.templatePaths).length
			? strings(raw.templatePaths)
			: text(raw.templatePath)
				? [text(raw.templatePath)]
				: [],
		sortBy: ['title', 'created', 'due'].includes(text(raw.sortBy))
			? (raw.sortBy as PipelineConfig['sortBy'])
			: raw.sortBy === 'ctime'
				? 'created'
				: 'modified',
		sortDesc: raw.sortDesc !== false,
		filterFields: strings(raw.filterFields),
		filters: Object.fromEntries(
			Object.entries(
				raw.filter ? { [text(record(raw.filter).dim)]: text(record(raw.filter).value) } : record(raw.filters),
			).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
		),
		search: text(raw.search),
		skills,
	};
}
