import { WORKBENCH_FEATURES, type WorkbenchFeature, type WorkbenchTarget } from '../app/contracts/workbench';

/** Per-leaf shell state, saved with the workspace layout. */
export interface WorkbenchState {
	target: WorkbenchTarget;
	/** Side panel width in px (220–360). */
	panelWidth: number;
	/** ChatGPT-style: the active rail icon toggles this; switching modules keeps it. */
	panelOpen: boolean;
	/** A leaf opened with "Open in new tab/split": only the page is shown. */
	focus: boolean;
	/** The last route of each module in this leaf, restored when its rail icon is clicked. */
	lastTargets: Partial<Record<WorkbenchFeature, WorkbenchTarget>>;
}

export const PANEL_MIN = 220;
export const PANEL_MAX = 360;
export const PANEL_DEFAULT = 260;

const sections: Partial<Record<WorkbenchFeature, readonly string[]>> = {
	terminal: ['running', 'history', 'usage'],
	contacts: ['person', 'company'],
	automations: ['tasks', 'runs'],
	notifications: ['unread', 'all'],
	comments: ['open', 'all'],
	records: ['habits', 'expenses', 'pomodoro', 'reading'],
	sync: ['changes', 'history'],
};
/** Features whose sections are open-ended ids (settings categories, icon settings pages). */
const freeSections = new Set<WorkbenchFeature>(['settings', 'icons']);

const safeText = (value: unknown, max: number): string | undefined =>
	typeof value === 'string' && value.length > 0 && value.length <= max && ![...value].some((character) => character.charCodeAt(0) < 32) ? value : undefined;

export function normalizeTarget(raw: unknown): WorkbenchTarget {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { feature: 'dashboard' };
	const value = raw as Record<string, unknown>;
	if (!WORKBENCH_FEATURES.some((feature) => feature === value.feature)) return { feature: 'dashboard' };
	const feature = value.feature as WorkbenchFeature;
	const target: WorkbenchTarget = { feature };
	const section = safeText(value.section, 64);
	if (section && (freeSections.has(feature) ? /^[a-z0-9-]+$/.test(section) : sections[feature]?.includes(section))) target.section = section;
	const resourceId = safeText(value.resourceId, 2048), focusId = safeText(value.focusId, 256);
	if (resourceId) target.resourceId = resourceId;
	if (focusId) target.focusId = focusId;
	return target;
}

export function targetKey(target: WorkbenchTarget): string {
	return JSON.stringify([target.feature, target.section ?? '', target.resourceId ?? '', target.focusId ?? '']);
}

export function panelWidth(raw: unknown): number {
	return typeof raw === 'number' && Number.isFinite(raw) ? Math.round(Math.max(PANEL_MIN, Math.min(PANEL_MAX, raw))) : PANEL_DEFAULT;
}

export function normalizeWorkbenchState(raw: unknown): WorkbenchState {
	const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
	const last = value.lastTargets && typeof value.lastTargets === 'object' && !Array.isArray(value.lastTargets) ? (value.lastTargets as Record<string, unknown>) : {};
	const lastTargets: WorkbenchState['lastTargets'] = {};
	for (const feature of WORKBENCH_FEATURES) {
		if (!last[feature]) continue;
		const target = normalizeTarget(last[feature]);
		if (target.feature === feature) lastTargets[feature] = target;
	}
	return {
		target: normalizeTarget(value.target),
		panelWidth: panelWidth(value.panelWidth),
		panelOpen: value.panelOpen !== false,
		focus: value.focus === true,
		lastTargets,
	};
}

/** Workspace state is a bounded projection, never a second business store. */
export function cleanPageState(raw: unknown, keys: readonly string[]): Record<string, unknown> {
	const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
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
