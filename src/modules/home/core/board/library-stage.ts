import { advanceStage, type AdvanceResult } from './pipeline';

export interface LibraryStageMove {
	mode: 'folder' | 'property';
	path: string;
	destination: string;
	siblingNames: readonly string[];
	statusField: string;
	stageValue: string;
	writeStatus: (path: string, field: string, value: string) => 'ok' | 'failed';
	rename?: (from: string, to: string) => 'ok' | 'failed';
}

/**
 * Decide a kanban move before the vault write.
 * Folder roots are the destination parent. A destination with no parent is its own root and is not nested again.
 * Property moves have no folder, so only the status write can refuse them.
 */
export function libraryStageMove(input: LibraryStageMove): AdvanceResult {
	const fileName = input.path.split('/').pop() ?? '';
	if (input.mode === 'property') {
		return advanceStage({
			path: input.path,
			config: {
				rootFolder: input.path.split('/').slice(0, -1).join('/') || input.path,
				statusField: input.statusField,
				stages: [{ id: 'next', value: input.stageValue, label: input.stageValue }],
			},
			targetStageId: 'next',
			siblingNames: [],
			writeStatus: input.writeStatus,
		});
	}
	const normalized = input.destination.replaceAll('\\', '/').replace(/\/+$/, '');
	const slash = normalized.lastIndexOf('/');
	const root = slash > 0 ? normalized.slice(0, slash) : normalized;
	const stageFolder = slash > 0 ? normalized.slice(slash + 1) : undefined;
	if (!stageFolder && normalized !== input.path.split('/').slice(0, -1).join('/') && input.siblingNames.includes(fileName)) {
		return { status: 'refused', path: input.path, error: 'name-clash', completed: [] };
	}
	return advanceStage({
		path: input.path,
		config: {
			rootFolder: root,
			statusField: input.statusField,
			stages: [{ id: 'next', value: input.stageValue, label: input.stageValue, ...(stageFolder ? { folder: stageFolder } : {}) }],
		},
		targetStageId: 'next',
		siblingNames: input.siblingNames,
		writeStatus: input.writeStatus,
		rename: input.rename,
	});
}
