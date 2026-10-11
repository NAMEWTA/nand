import { BrowserError } from '../model';
import type { WorkspacePanelLayout, WorkspaceTask } from './model';

export type PanelChange = { kind: 'move'; targetId: string; direction: -1 | 1 }
	| { kind: 'width'; targetId: string; width: number }
	| { kind: 'focus' | 'maximize' | 'restore'; targetId: string };

export function panelLayout(task: WorkspaceTask): WorkspacePanelLayout {
	return structuredClone(task.panelLayout ?? { order: task.targets.map(target => target.id), widths: {} });
}
export function validatePanelLayout(task: WorkspaceTask): void {
	const layout = task.panelLayout; if (layout === undefined) return;
	if (!layout) throw new BrowserError('browser_workspace_storage');
	const ids = new Set(task.targets.map(target => target.id));
	if (!Array.isArray(layout.order) || layout.order.length !== ids.size || new Set(layout.order).size !== ids.size || layout.order.some(id => !ids.has(id))
		|| !layout.widths || typeof layout.widths !== 'object' || Array.isArray(layout.widths)
		|| Object.entries(layout.widths).some(([id, width]) => !ids.has(id) || !Number.isFinite(width) || width < 0.5 || width > 3)
		|| [layout.focused, layout.maximized].some(id => id !== undefined && !ids.has(id))) throw new BrowserError('browser_workspace_storage');
}

/** Presentation changes never alter target bindings, recipient order or immutable rounds. */
export function changePanelLayout(task: WorkspaceTask, change: PanelChange): void {
	const layout = panelLayout(task), index = layout.order.indexOf(change.targetId);
	if (index < 0) throw new BrowserError('browser_workspace_targets');
	if (change.kind === 'move') {
		const neighbor = index + change.direction;
		if ((change.direction !== -1 && change.direction !== 1) || !layout.order[neighbor]) throw new BrowserError('browser_workspace_panel_layout');
		[layout.order[index], layout.order[neighbor]] = [layout.order[neighbor], layout.order[index]!];
	} else if (change.kind === 'width') {
		if (!Number.isFinite(change.width) || change.width < 0.5 || change.width > 3) throw new BrowserError('browser_workspace_panel_layout');
		layout.widths[change.targetId] = change.width;
	} else if (change.kind === 'restore') {
		if (layout.maximized === change.targetId) delete layout.maximized;
	} else if (change.kind === 'focus' || change.kind === 'maximize') {
		if (!task.visibleTargetIds.includes(change.targetId)) throw new BrowserError('browser_workspace_panel_layout');
		layout.focused = change.targetId;
		if (change.kind === 'maximize') layout.maximized = change.targetId;
		else delete layout.maximized;
	} else throw new BrowserError('browser_workspace_panel_layout');
	task.panelLayout = layout;
}

export function removePanelLayoutTarget(task: WorkspaceTask, targetId: string): void {
	const layout = task.panelLayout; if (!layout) return;
	layout.order = layout.order.filter(id => id !== targetId); delete layout.widths[targetId];
	if (layout.focused === targetId) delete layout.focused;
	if (layout.maximized === targetId) delete layout.maximized;
}
