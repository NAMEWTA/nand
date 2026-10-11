import { BrowserError } from '../model';
import type { AnswerCapture, SelectedExcerpt, TargetBinding, WorkspaceExchange, WorkspaceTurn } from './model';

export interface CaptureReference { exchangeId: string; captureId: string }
export interface ComparedAnswer { target: TargetBinding; exchangeId: string; capture: AnswerCapture | SelectedExcerpt; current: boolean }

/** A comparison keeps the chosen revision, even after a newer partial capture arrives. */
export function compareAnswers(turn: WorkspaceTurn, exchanges: readonly WorkspaceExchange[], references: readonly CaptureReference[]): ComparedAnswer[] {
	if (references.length < 2 || references.length > 3 || new Set(references.map(row => row.exchangeId)).size !== references.length)
		throw new BrowserError('browser_workspace_comparison_targets');
	return references.map(reference => {
		const exchange = exchanges.find(row => row.id === reference.exchangeId && row.turnId === turn.id);
		const target = turn.targets.find(row => row.id === exchange?.targetId), capture = [...(exchange?.captures ?? []), ...(exchange?.selections ?? [])].find(row => row.id === reference.captureId);
		if (!exchange || !target || !capture || capture.exchangeId !== exchange.id) throw new BrowserError('browser_workspace_answer_missing');
		return { target: structuredClone(target), exchangeId: exchange.id, capture: structuredClone(capture), current: capture.id === exchange.currentCaptureId };
	});
}
