import { displayFocal, focalForWrite, type FocalPoint } from './board-experience';

// Format and crop semantics follow the pinned MIT apex-dashboard focal-point-picker.
// db9d2892032c27f5f8899a72c0dca61d72572a9a. Copyright (c) 2025 PandoraReads.
// NAND retains raw persisted values until an intentional edit; see NOTICE.
export function parseFocalPoint(raw: unknown): FocalPoint | undefined {
	if (typeof raw !== 'string') return undefined;
	const parts = /^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/.exec(raw);
	return parts ? focalForWrite({ x: parts[1], y: parts[2] }) : undefined;
}

export function displayedFocalPoint(raw: unknown): FocalPoint {
	return displayFocal(parseFocalPoint(raw));
}

/** Center is implicit. Only the explicitly edited image gets a normalized value. */
export function formatFocalPoint(point: FocalPoint): string | undefined {
	const normalized = displayFocal(point);
	return normalized.x === 50 && normalized.y === 50 ? undefined : `${normalized.x},${normalized.y}`;
}

export function focalPosition(raw: unknown): string {
	const { x, y } = displayedFocalPoint(raw);
	return `${x}% ${y}%`;
}

export function editImageFocal(map: Record<string, unknown> | undefined, path: string, point: FocalPoint): Record<string, unknown> | undefined {
	const formatted = formatFocalPoint(point);
	const next = formatted === undefined ? { ...map } : { ...map, [path]: formatted };
	if (formatted === undefined) delete next[path];
	return Object.keys(next).length ? next : undefined;
}

/** Vault rename events identify the exact resource; similarly named paths and URLs stay intact. */
export function renamedImagePath(path: string, oldPath: string, newPath: string, folder: boolean): string {
	if (/^https?:\/\//i.test(path)) return path;
	if (path === oldPath) return newPath;
	return folder && path.startsWith(`${oldPath}/`) ? newPath + path.slice(oldPath.length) : path;
}
