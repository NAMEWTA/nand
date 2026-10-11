import type { PipelineConfig } from '../board/types/model';
export type { PipelineConfig, PipelineStage, PipelineSkill } from '../board/types/model';
export interface PipelineNote {
	path: string;
	title: string;
	mtime: number;
	ctime: number;
	frontmatter: Record<string, unknown>;
}
export interface PipelineTask {
	line: number;
	originalLine: string;
	text: string;
	checked: boolean;
}
export const emptyPipeline = (): PipelineConfig => ({ rootFolder: '', statusField: 'status', stages: [], excludeFolders: [], templatePaths: [], sortBy: 'modified', sortDesc: true, filterFields: [], filters: {}, search: '', skills: [] });
