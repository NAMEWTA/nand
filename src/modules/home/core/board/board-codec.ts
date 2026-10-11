import type { BoardTile, BoardWidgetMember } from './types/model';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const clamp = (value: unknown, min: number, max: number, fallback: number) => finite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;

/** Diagnostics are transient; reading malformed geometry must not rewrite the original document. */
export function boardTilesNeedRepair(value: unknown): boolean {
	if (value === undefined) return false;
	if (!Array.isArray(value)) return true;
	const seen = new Set<string>();
	return value.some(entry => {
		if (!record(entry) || !text(entry.id) || seen.has(text(entry.id))) return true;
		seen.add(text(entry.id));
		if (!finite(entry.w) || !Number.isInteger(entry.w) || entry.w < 1 || entry.w > 12) return true;
		const height = entry.cap ?? entry.h;
		if (!finite(height) || height <= 0 || height > 240 || (entry.cap !== undefined && (height < 3 || !Number.isInteger(height)))) return true;
		if (entry.x === undefined && entry.y === undefined) return false;
		return !finite(entry.x) || !finite(entry.y) || !Number.isInteger(entry.x) || !Number.isInteger(entry.y) || entry.x < 0 || entry.y < 0 || entry.x + entry.w > 12;
	});
}

/** Availability never affects persistence: unknown providers and removed instances retain their references. */
export function readBoardMembers(value: unknown): BoardWidgetMember[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const seen = new Set<string>();
	const members: BoardWidgetMember[] = [];
	for (const entry of value) {
		if (!record(entry)) continue;
		const memberId = text(entry.memberId), provider = text(entry.provider), kind = text(entry.kind), instanceId = text(entry.instanceId);
		if (!memberId || !provider || !kind || !instanceId || seen.has(memberId)) continue;
		seen.add(memberId);
		members.push({ memberId, provider, kind, instanceId, ...(text(entry.label) ? { label: text(entry.label) } : {}), ...(text(entry.icon) ? { icon: text(entry.icon) } : {}) });
	}
	return members;
}

/**
 * Height migration follows apex-dashboard (MIT), src/immersive-grid.ts and src/parser.ts,
 * reviewed at db9d2892032c27f5f8899a72c0dca61d72572a9a. Copyright (c) 2025 PandoraReads.
 * The persisted cap key distinguishes fine rows from the former coarse h field.
 */
export function readBoardTiles(value: unknown): BoardTile[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const seen = new Set<string>();
	const tiles: BoardTile[] = [];
	for (const entry of value) {
		if (!record(entry)) continue;
		const id = text(entry.id);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		const legacy = finite(entry.h) && entry.h > 0 && entry.h <= 12 ? Math.ceil((entry.h * 92 + 10) / 10) : entry.h;
		const cap = clamp(finite(entry.cap) ? entry.cap : legacy, 3, 240, 40);
		const position = finite(entry.x) && finite(entry.y) && entry.x >= 0 && entry.y >= 0 ? { x: Math.round(entry.x), y: Math.round(entry.y) } : {};
		tiles.push({ id, w: clamp(entry.w, 1, 12, 3), cap, ...(entry.fixed === true ? { fixed: true } : {}), ...position });
	}
	return tiles;
}
