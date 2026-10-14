import type { WorkbenchTarget } from '../contracts/workbench';

export interface FocusLeafState extends Record<string, unknown> {
	target: WorkbenchTarget;
	focus: true;
	pages: Array<{ target: WorkbenchTarget; state: Record<string, unknown> }>;
}

/** Open the selected feature in a focus-mode workbench leaf. Browser tabs belong to the agent workspace. */
export function focusLeafState(target: WorkbenchTarget, state: Record<string, unknown>): FocusLeafState {
 return { target, focus: true, pages: [{ target, state }] };
}
