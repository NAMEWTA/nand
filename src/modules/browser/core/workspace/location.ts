export const DEFAULT_WORKSPACE_FOLDER = 'NAND/AI Workspace';

/** Visible vault-relative folder only. Private/device state is stored separately. */
export function workspaceFolder(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const path = value.trim().replace(/\\/g, '/');
	if (!path || path.length > 240 || /[<>:"|?*]/.test(path) || [...path].some(character => character.charCodeAt(0) < 32)) return undefined;
	const parts = path.split('/');
	if (parts.some(part => !part || part.startsWith('.') || part.trim() !== part || /[. ]$/.test(part)
		|| /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) return undefined;
	return path;
}
