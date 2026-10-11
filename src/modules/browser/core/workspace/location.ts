import { contentPath } from '../../../../shared/storage/content-paths';
export const DEFAULT_WORKSPACE_FOLDER = contentPath('NAND/AI Workspace');

/** Folder names are relative to NAND content; existing absolute content paths remain stable. */
export function workspaceFolder(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const path = value.trim().replace(/\\/g, '/');
	if (!path || path.length > 240 || /[<>:"|?*]/.test(path) || [...path].some(character => character.charCodeAt(0) < 32)) return undefined;
	try { return contentPath(path); } catch { return undefined; }
}
