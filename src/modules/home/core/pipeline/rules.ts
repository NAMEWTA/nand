import type { PipelineConfig, PipelineNote, PipelineStage, PipelineTask } from './model';
import { readMarkdownDocument } from '../../../../shared/storage/markdown-document';

/** Reject traversal and absolute paths before any normalizer could hide them. */
export function pipelinePath(value: string): string | undefined {
	const path = value.trim().replaceAll('\\', '/').replace(/\/+$/, '');
	if (!path || path.startsWith('/') || path.includes(':') || [...path].some(char => char.charCodeAt(0) < 32)) return;
	const parts = path.split('/');
	if (parts.some(part => !part || part === '.' || part === '..')) return;
	return path;
}
export function withinPipeline(root: string, path: string): boolean {
	const base = pipelinePath(root), target = pipelinePath(path);
	return !!base && !!target && target.startsWith(`${base}/`);
}
export function resolvePipelineStage(config: PipelineConfig, status: unknown): PipelineStage | undefined {
	return typeof status === 'string' ? config.stages.find(stage => stage.value.trim().toLocaleLowerCase() === status.trim().toLocaleLowerCase()) : undefined;
}
export function pipelineConfigError(config: PipelineConfig): string | undefined {
	if (!pipelinePath(config.rootFolder)) return 'root';
	if (!config.statusField.trim() || /[\r\n]/.test(config.statusField) || ['__proto__', 'constructor', 'prototype'].includes(config.statusField)) return 'field';
	if (!config.stages.length) return 'stages';
	const ids = new Set<string>(), values = new Set<string>();
	for (const stage of config.stages) {
		const value = stage.value.trim().toLocaleLowerCase();
		if (!stage.id.trim() || stage.id === 'archive' || !value || !stage.label.trim() || ids.has(stage.id) || values.has(value) || value === 'archived') return 'stages';
		if (stage.folder && !pipelinePath(stage.folder)) return 'folder';
		ids.add(stage.id); values.add(value);
	}
	if (config.archiveFolder && !pipelinePath(config.archiveFolder)) return 'folder';
	if (config.excludeFolders.some(folder => !pipelinePath(folder))) return 'folder';
	return undefined;
}
export function pipelineIncludes(config: PipelineConfig, note: PipelineNote): boolean {
	return withinPipeline(config.rootFolder, note.path) && !config.excludeFolders.some(folder => withinPipeline(folder, note.path)) && !!resolvePipelineStage(config, note.frontmatter[config.statusField]);
}
/** Pure preflight. Destination occupancy is checked by the vault adapter before a write. */
export function pipelineDestination(config: PipelineConfig, path: string, target: PipelineStage | 'archive'): string {
	if (pipelineConfigError(config) || !withinPipeline(config.rootFolder, path)) throw new Error('home.pipeline.invalidPath');
	const folder = target === 'archive' ? config.archiveFolder : target.folder ? `${pipelinePath(config.rootFolder)!}/${pipelinePath(target.folder) ?? '..'}` : undefined;
	if (target === 'archive' && !folder) throw new Error('home.pipeline.archiveMissing');
	if (!folder) return path;
	const normalized = pipelinePath(folder);
	if (!normalized || (target !== 'archive' && !withinPipeline(config.rootFolder, `${normalized}/note.md`))) throw new Error('home.pipeline.invalidPath');
	return `${normalized}/${path.split('/').pop()!}`;
}
export function pipelineFieldValues(value: unknown): string[] {
	return (Array.isArray(value) ? value : [value]).flatMap(item => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' ? [String(item)] : []);
}
/** Cap after filtering/sorting; counts still describe the full matching result. */
export function selectPipelineNotes(config: PipelineConfig, notes: readonly PipelineNote[]): PipelineNote[] {
	const query = config.search.trim().toLocaleLowerCase();
	const matching = notes.filter(note => pipelineIncludes(config, note)
		&& (!query || `${note.title}\n${note.path}`.toLocaleLowerCase().includes(query))
		&& config.filterFields.every(field => !config.filters[field] || pipelineFieldValues(note.frontmatter[field]).some(value => value.toLocaleLowerCase() === config.filters[field]!.toLocaleLowerCase())));
	const key = (note: PipelineNote): string | number => config.sortBy === 'modified' ? note.mtime : config.sortBy === 'created' ? note.ctime : config.sortBy === 'due' ? (typeof note.frontmatter.due === 'string' ? note.frontmatter.due : '') : note.title;
	matching.sort((a, b) => {
		const left = key(a), right = key(b);
		const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
		return (config.sortDesc ? -order : order) || a.path.localeCompare(b.path);
	});
	return matching;
}
export function projectPipeline(config: PipelineConfig, notes: readonly PipelineNote[]) {
	const matching = selectPipelineNotes(config, notes);
	const candidates = matching.slice(0, 500);
	return { total: matching.length, truncated: matching.length > candidates.length, stages: config.stages.map(stage => ({
		stage, total: matching.filter(note => resolvePipelineStage(config, note.frontmatter[config.statusField])?.id === stage.id).length,
		notes: candidates.filter(note => resolvePipelineStage(config, note.frontmatter[config.statusField])?.id === stage.id),
	})) };
}
export function pipelineTasks(raw: string): PipelineTask[] {
	const { body } = readMarkdownDocument(raw);
	const offset = raw.slice(0, raw.length - body.length).split('\n').length - 1;
	let fence = '';
	const tasks: PipelineTask[] = [];
	for (const [line, originalLine] of body.split('\n').entries()) {
		const marker = /^\s*(`{3,}|~{3,})/.exec(originalLine)?.[1];
		if (marker) { if (!fence) fence = marker; else if (marker[0] === fence[0] && marker.length >= fence.length) fence = ''; continue; }
		if (fence) continue;
		const match = /^\s*[-*+] \[([ xX])\]\s+(.*)/.exec(originalLine);
		if (match) tasks.push({ line: line + offset, originalLine, text: match[2]!.trimEnd(), checked: match[1] !== ' ' });
	}
	return tasks;
}
/** Match the original task against the latest body; refuse ambiguous or edited lines. */
export function togglePipelineTask(raw: string, task: PipelineTask, checked: boolean): string {
	const current = pipelineTasks(raw).filter(item => item.originalLine === task.originalLine);
	if (current.length !== 1) throw new Error('home.pipeline.taskChanged');
	const lines = raw.split('\n'), index = current[0]!.line;
	lines[index] = lines[index]!.replace(/^(\s*[-*+] \[)[ xX](\])/, `$1${checked ? 'x' : ' '}$2`);
	return lines.join('\n');
}
