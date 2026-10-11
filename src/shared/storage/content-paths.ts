import { nandPath, validateNandPath } from './nand-paths';

export const CONTENT_ROOT = nandPath('content');
export function isContentPath(path: string): boolean { return path === CONTENT_ROOT || path.startsWith(CONTENT_ROOT + '/'); }
/** Keeps the old relative hierarchy; repeated normalization never nests the content root. */
export function contentPath(relative = ''): string {
	if (isContentPath(relative)) return validateNandPath(relative);
	if (relative.split('/').some(part => part.startsWith('.'))) throw new Error('nand-content.invalid-path');
	return relative ? nandPath('content', relative) : CONTENT_ROOT;
}
