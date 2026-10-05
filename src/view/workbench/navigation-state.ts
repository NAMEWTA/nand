import { WORKBENCH_FEATURES, type WorkbenchFeature, type WorkbenchTarget } from '../contracts/workbench';

export interface WorkbenchState {
	target: WorkbenchTarget;
	sidebarWidth: number;
	sidebarOpen: boolean;
	expanded: string[];
}
const sections: Record<WorkbenchFeature, readonly string[]> = {
	dashboard: [], terminal: ['running', 'history', 'usage'], browser: [],
	contacts: ['person', 'company'], automations: ['tasks', 'runs'],
	notifications: [], habit: [], expense: [],
};
const safeText = (value: unknown, max: number): string | undefined =>
	typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value) ? value : undefined;
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
		expanded: Array.isArray(value.expanded) ? [...new Set(value.expanded.filter((id): id is string => typeof id === 'string' && WORKBENCH_FEATURES.some((feature) => feature === id)))] : [],
	};
}
