import type { WorkbenchTarget } from '../contracts/workbench';

export interface FocusLeafState extends Record<string, unknown> {
	target: WorkbenchTarget;
	focus: true;
	pages: Array<{ target: WorkbenchTarget; state: Record<string, unknown> }>;
}

/** "Open in new tab/split" opens a focus-mode workbench leaf. Browser copies get a new page id and no session secrets. */
export function focusLeafState(target: WorkbenchTarget, state: Record<string, unknown>): FocusLeafState {
	if (target.feature !== 'browser') return { target, focus: true, pages: [{ target, state }] };
	const id = crypto.randomUUID();
	const copied: WorkbenchTarget = { feature: 'browser', resourceId: id };
	const page: Record<string, unknown> = { id };
	if (typeof state.url === 'string') page.url = state.url;
	if (typeof state.title === 'string') page.title = state.title;
	if (typeof state.zoom === 'number' && Number.isFinite(state.zoom)) page.zoom = state.zoom;
	if (state.scroll && typeof state.scroll === 'object' && !Array.isArray(state.scroll)) page.scroll = state.scroll;
	return { target: copied, focus: true, pages: [{ target: copied, state: page }] };
}
