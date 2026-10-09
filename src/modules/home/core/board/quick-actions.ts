import type { QuickAction } from "./types/index";
import { PRESET_ACTIONS } from "./types/index";



export function actionKey(action: QuickAction, isPreset: boolean): string {
	return isPreset ? `p:${action.target}` : `c:${action.target}`;
}


export interface OrderedAction {
	action: QuickAction;
	isPreset: boolean;
	key: string;
}


export function buildOrderedActions(actions: QuickAction[], order?: string[], hiddenPresets?: string[]): OrderedAction[] {
	const hidden = new Set(hiddenPresets ?? []);
	const all: OrderedAction[] = [
		...PRESET_ACTIONS.filter((a) => !hidden.has(actionKey(a, true))).map((a) => ({
			action: a,
			isPreset: true,
			key: actionKey(a, true),
		})),
		...actions.map((a) => ({ action: a, isPreset: false, key: actionKey(a, false) })),
	];

	if (!order || order.length === 0) return all;

	const keySet = new Set(order);
	const ordered: OrderedAction[] = [];
	for (const k of order) {
		const found = all.find((a) => a.key === k);
		if (found) ordered.push(found);
	}
	for (const a of all) {
		if (!keySet.has(a.key)) ordered.push(a);
	}
	return ordered;
}