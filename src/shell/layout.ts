import type { WorkbenchFeature, WorkbenchTarget } from '../app/contracts/workbench';
import type { WorkbenchState } from './navigation-state';

/** Shell layouts by container width: inline panel, overlay panel, or one combined drawer. */
export type ShellLayout = 'wide' | 'medium' | 'narrow';
export const WIDE_MIN = 960;
export const MEDIUM_MIN = 600;

export function layoutFor(width: number, phone: boolean): ShellLayout {
	if (phone || width < MEDIUM_MIN) return 'narrow';
	return width < WIDE_MIN ? 'medium' : 'wide';
}

export type RailAction = { kind: 'toggle-panel' } | { kind: 'navigate'; target: WorkbenchTarget };

/**
 * ChatGPT-style rail: clicking the active icon toggles the side panel; clicking another icon
 * returns to that module's last route in this leaf and leaves the panel as it is.
 */
export function railAction(state: WorkbenchState, feature: WorkbenchFeature): RailAction {
	if (state.target.feature === feature) return { kind: 'toggle-panel' };
	return { kind: 'navigate', target: state.lastTargets[feature] ?? { feature } };
}

/** Remember `target` as its module's last route. */
export function rememberTarget(state: WorkbenchState, target: WorkbenchTarget): WorkbenchState {
	return { ...state, target, lastTargets: { ...state.lastTargets, [target.feature]: target } };
}
