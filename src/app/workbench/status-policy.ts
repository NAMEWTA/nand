import type { WorkbenchStatus } from '../contracts/workbench';
const priorities: Record<WorkbenchStatus['kind'], number> = { error: 0, running: 1, unread: 2, info: 3 };
/** A status bar is not a launcher. Idle and informational entries are opt-in. */
export function visibleStatuses(statuses: readonly WorkbenchStatus[], showInfo = false, limit = 3): WorkbenchStatus[] {
	const unique = new Map<string, WorkbenchStatus>();
	for (const item of statuses) {
		if (!item.id || !item.label || (item.kind === 'info' && !showInfo)) continue;
		const old = unique.get(item.id);
		if (!old || priorities[item.kind] < priorities[old.kind]) unique.set(item.id, item);
	}
	return [...unique.values()].sort((a, b) => priorities[a.kind] - priorities[b.kind] || a.id.localeCompare(b.id)).slice(0, Math.max(0, Math.floor(limit)));
}

/** One unresolved board save stays visible until that board leaves the error. Saving and saved stay quiet. */
export function dashboardSaveStatuses(entries: readonly { path: string; status: string; message: string }[]): WorkbenchStatus[] {
	const rows: WorkbenchStatus[] = [];
	const seen = new Set<string>();
	for (const entry of entries) {
		if (!entry.path || seen.has(entry.path) || entry.status === 'saved' || entry.status === 'saving' || !entry.message) continue;
		seen.add(entry.path);
		rows.push({ id: 'dashboard-save:' + entry.path, kind: 'error', label: entry.message, target: { feature: 'dashboard', resourceId: entry.path } });
	}
	return rows;
}
