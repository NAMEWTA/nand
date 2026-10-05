import type { WorkbenchTarget } from '../contracts/workbench';

export interface SplitLeafState extends Record<string, unknown> {
	target: WorkbenchTarget;
	pages: Array<{ target: WorkbenchTarget; state: Record<string, unknown> }>;
}

/** A split is a new workbench leaf. Browser copies get a new page id and no session secrets. */
export function splitLeafState(target: WorkbenchTarget, state: Record<string, unknown>): SplitLeafState {
	if (target.feature !== 'browser') return { target, pages: [{ target, state }] };
	const id = crypto.randomUUID();
	const copied: WorkbenchTarget = { feature: 'browser', resourceId: id };
	const page: Record<string, unknown> = { id };
	if (typeof state.url === 'string') page.url = state.url;
	if (typeof state.title === 'string') page.title = state.title;
	if (typeof state.zoom === 'number' && Number.isFinite(state.zoom)) page.zoom = state.zoom;
	if (state.scroll && typeof state.scroll === 'object' && !Array.isArray(state.scroll)) page.scroll = state.scroll;
	return { target: copied, pages: [{ target: copied, state: page }] };
}
