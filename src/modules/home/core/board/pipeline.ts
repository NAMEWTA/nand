export interface PipelineStage {
	id: string;
	value: string;
	label: string;
	folder?: string;
}

export interface PipelineConfig {
	rootFolder: string;
	statusField: string;
	stages: readonly PipelineStage[];
	excludeFolders?: readonly string[];
	archiveFolder?: string;
}

export function normalizeVaultPath(value: string): string {
	const parts: string[] = [];
	for (const part of value.replaceAll('\\', '/').split('/')) {
		if (!part || part === '.') continue;
		if (part === '..') return '';
		parts.push(part);
	}
	return parts.join('/');
}

export function pathWithinRoot(root: string, target: string): boolean {
	const base = normalizeVaultPath(root);
	const next = normalizeVaultPath(target);
	if (!base || !next) return false;
	return next === base || next.startsWith(`${base}/`);
}

export interface AdvanceInput {
	path: string;
	config: PipelineConfig;
	targetStageId: string;
	/** File names already in the destination folder. */
	siblingNames: readonly string[];
	writeStatus: (path: string, field: string, value: string) => 'ok' | 'failed';
	rename?: (from: string, to: string) => 'ok' | 'failed';
}

export interface AdvanceResult {
	status: 'done' | 'refused' | 'partial';
	path: string;
	error?: string;
	completed: readonly string[];
}

/** Refuse a name clash or a path that escapes the root before any write. A failed rename after a status write is partial. */
export function advanceStage(input: AdvanceInput): AdvanceResult {
	const stage = input.config.stages.find((item) => item.id === input.targetStageId);
	if (!stage) return { status: 'refused', path: input.path, error: 'unknown-stage', completed: [] };
	const root = input.config.rootFolder.replace(/\/$/, '');
	const folder = stage.folder ? `${root}/${stage.folder}` : '';
	const fileName = input.path.split('/').pop() ?? '';
	const destination = folder ? `${normalizeVaultPath(folder)}/${fileName}` : input.path;
	if (folder && !pathWithinRoot(root, destination)) return { status: 'refused', path: input.path, error: 'path-escape', completed: [] };
	if (folder && destination !== input.path && input.siblingNames.includes(fileName)) {
		return { status: 'refused', path: input.path, error: 'name-clash', completed: [] };
	}
	if (input.writeStatus(input.path, input.config.statusField, stage.value) === 'failed') {
		return { status: 'refused', path: input.path, error: 'status-failed', completed: [] };
	}
	if (!folder || destination === input.path || !input.rename) return { status: 'done', path: input.path, completed: ['status'] };
	if (input.rename(input.path, destination) === 'failed') return { status: 'partial', path: input.path, error: 'rename-failed', completed: ['status'] };
	return { status: 'done', path: destination, completed: ['status', 'rename'] };
}
