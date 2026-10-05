import { WORKBENCH_FEATURES, type WorkbenchFeature, type WorkbenchTarget } from '../contracts/workbench';

export interface WorkbenchState {
	target: WorkbenchTarget;
	sidebarWidth: number;
	sidebarOpen: boolean;
	expanded: string[];
	collapsed: string[];
}
const sections: Record<WorkbenchFeature, readonly string[]> = {
	dashboard: [], terminal: ['running', 'history', 'usage'], browser: [],
	contacts: ['person', 'company'], automations: ['tasks', 'runs'],
	notifications: [], habit: [], expense: [],
};
const safeText = (value: unknown, max: number): string | undefined =>
	typeof value === 'string' && value.length > 0 && value.length <= max && ![...value].some((character) => character.charCodeAt(0) < 32) ? value : undefined;
export function normalizeTarget(raw: unknown): WorkbenchTarget {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { feature: 'dashboard' };
	const value = raw as Record<string, unknown>;
	if (!WORKBENCH_FEATURES.some((feature) => feature === value.feature)) return { feature: 'dashboard' };
	const feature = value.feature as WorkbenchFeature;
	const target: WorkbenchTarget = { feature };
	if (typeof value.section === 'string' && sections[feature].includes(value.section)) target.section = value.section;
	const resourceId = safeText(value.resourceId, 2048), focusId = safeText(value.focusId, 256);
	if (resourceId) target.resourceId = resourceId;
	if (focusId) target.focusId = focusId;
	return target;
}
export function targetKey(target: WorkbenchTarget): string {
	return JSON.stringify([target.feature, target.section ?? '', target.resourceId ?? '', target.focusId ?? '']);
}
export function navigationWidth(raw: unknown): number {
	return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(208, Math.min(280, raw)) : 232;
}
export function normalizeWorkbenchState(raw: unknown): WorkbenchState {
	const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
	return {
		target: normalizeTarget(value.target),
		sidebarWidth: navigationWidth(value.sidebarWidth),
		sidebarOpen: value.sidebarOpen !== false,
		expanded: normalizeGroups(value.expanded),
		collapsed: normalizeGroups(value.collapsed),
	};
}

function normalizeGroups(raw: unknown): string[] {
 return Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => typeof id === 'string' && WORKBENCH_FEATURES.some((feature) => feature === id)))] : [];
}

/** Workspace state is a bounded projection, never a second business store. */
export function cleanPageState(raw: unknown, keys: readonly string[]): Record<string, unknown> {
 const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
 const forbidden = /^(?:__proto__|prototype|constructor|password|cookie|cookies|token|accessToken|refreshToken|authorization|credentials|secret)$/i;
 const clean = (item: unknown, depth: number): unknown => {
  if (item === null || typeof item === 'boolean') return item;
  if (typeof item === 'string') return item.slice(0, 8192);
  if (typeof item === 'number') return Number.isFinite(item) ? item : undefined;
  if (depth > 3 || !item || typeof item !== 'object') return undefined;
  if (Array.isArray(item)) return item.slice(0, 100).map((entry) => clean(entry, depth + 1)).filter((entry) => entry !== undefined);
  if (Object.prototype.toString.call(item) !== '[object Object]') return undefined;
  return Object.fromEntries(Object.entries(item).slice(0, 32).flatMap(([key, entry]) => {
   if (forbidden.test(key)) return [];
   const safe = clean(entry, depth + 1);
   return safe === undefined ? [] : [[key, safe]];
  }));
 };
 return Object.fromEntries(keys.flatMap((key) => {
  if (forbidden.test(key) || !Object.prototype.hasOwnProperty.call(value, key)) return [];
  const safe = clean(value[key], 0);
  return safe === undefined ? [] : [[key, safe]];
 }));
}
