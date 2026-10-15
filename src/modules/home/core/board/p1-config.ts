// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/parser.ts
import type { PmConfig, SkillsSectionConfig } from './types';
const rec = (v: unknown): Record<string, unknown> =>
	v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const text = (v: unknown) => (typeof v === 'string' ? v : '');
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
export function readPmConfig(value: unknown): PmConfig | undefined {
	if (!value || typeof value !== 'object') return;
	const raw = rec(value);
	return {
		rootFolder: text(raw.rootFolder),
		stages: (Array.isArray(raw.stages) ? raw.stages : []).flatMap((value) => {
			const stage = rec(value);
			return text(stage.label) ? [{ label: text(stage.label), color: text(stage.color) || undefined }] : [];
		}),
		pinned: strings(raw.pinned),
		order: strings(raw.order),
		excludeFolders: strings(raw.excludeFolders),
		archiveFolder: text(raw.archiveFolder),
		workNoteTemplate: text(raw.workNoteTemplate),
		sortMode: ['name', 'milestone', 'keyDate'].includes(text(raw.sortMode))
			? (raw.sortMode as PmConfig['sortMode'])
			: undefined,
		groupView: raw.groupView === 'blocks' || raw.groupView === 'kanban' ? raw.groupView : undefined,
		skills: (Array.isArray(raw.skills) ? raw.skills : []).flatMap((value) => {
			const s = rec(value);
			return text(s.label)
				? [
						{
							id: text(s.id) || text(s.label),
							label: text(s.label),
							agent: text(s.agent),
							icon: text(s.icon) || 'sparkles',
							skillName: text(s.skillName),
							promptTemplate: text(s.promptTemplate),
							directSend: s.directSend === true,
						},
					]
				: [];
		}),
	};
}
export function readSkillsConfig(value: unknown): SkillsSectionConfig | undefined {
	if (!value || typeof value !== 'object') return;
	const raw = rec(value);
	return {
		pinned: strings(raw.pinned),
		stores: strings(raw.stores),
		importTargets: strings(raw.importTargets),
		pageSize: [10, 20, 50, 100].includes(Number(raw.pageSize)) ? Number(raw.pageSize) : 50,
		sortMode: raw.sortMode === 'recent' ? 'recent' : 'name',
		sortDir: raw.sortDir === 'desc' ? 'desc' : 'asc',
		groupView: raw.groupView === 'groups' || raw.groupView === 'kanban' ? raw.groupView : undefined,
		groups: Array.isArray(raw.groups)
			? raw.groups.flatMap((value) => {
					const g = rec(value);
					return text(g.id) && text(g.name)
						? [{ id: text(g.id), name: text(g.name), keywords: text(g.keywords), color: text(g.color) }]
						: [];
				})
			: undefined,
		assignments: Object.fromEntries(
			Object.entries(rec(raw.assignments)).filter((e): e is [string, string] => typeof e[1] === 'string'),
		),
	};
}
