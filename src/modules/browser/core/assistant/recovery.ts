import { threeWayMerge } from '../../../../shared/storage/three-way-merge';
import { BrowserError } from '../model';
import { snapshotJson } from '../workspace/snapshot';
import { assistantMaterial, validateAssistant } from './documents';
import type { AssistantData, AssistantTask } from './model';

export interface AssistantRecoveryDraft { path: string; at: string; baseline: AssistantData; draft: AssistantData }
export interface AssistantRecoveryReview {
	id: string; file: string; at?: string; draftId?: string; local?: AssistantData; draft?: AssistantData;
	drafts: Array<{ id: string; at?: string; tasks: number }>; canRestore: boolean; unchanged: boolean; error?: string;
}
export const assistantUnfinished = (task: AssistantTask): boolean => ['pending', 'running', 'needs-attention', 'confirming'].includes(task.status);
export function interruptAssistant(task: AssistantTask, now: number): void {
	if (!assistantUnfinished(task)) return;
	task.status = 'interrupted'; task.updatedAt = now;
	for (const step of task.steps) if (step.state === 'running' || step.state === 'confirming') { step.state = 'unknown'; step.finishedAt = now; }
}
export function decodeAssistantRecovery(raw: unknown, key: string): AssistantRecoveryDraft {
	const value = raw as AssistantRecoveryDraft;
	if (!value || value.path !== key || typeof value.at !== 'string' || !Number.isFinite(Date.parse(value.at))) throw new BrowserError('browser_workspace_recovery_invalid');
	return { path: key, at: value.at, baseline: structuredClone(validateAssistant(value.baseline)), draft: structuredClone(validateAssistant(value.draft)) };
}
/** Restore observations, never authority. Only the exact derived restart transition is normalized. */
export function mergeAssistantRecovery(record: AssistantRecoveryDraft, current: AssistantData): AssistantData {
	const base = structuredClone(record.baseline), draft = structuredClone(record.draft), local = structuredClone(validateAssistant(current));
	for (const task of base.tasks) {
		const saved = local.tasks.find(row => row.id === task.id), recovered = draft.tasks.find(row => row.id === task.id);
		if (!saved || !recovered || snapshotJson(task) === snapshotJson(recovered)) continue;
		if (assistantMaterial(saved) !== assistantMaterial(recovered)) throw new BrowserError('browser_workspace_recovery_conflict');
		if (saved.status === 'interrupted' && assistantUnfinished(task)) {
			const interrupted = structuredClone(task); interruptAssistant(interrupted, saved.updatedAt);
			if (snapshotJson(interrupted) === snapshotJson(saved)) Object.assign(task, interrupted);
		}
	}
	const merged = threeWayMerge(base, draft, local);
	for (const task of merged.tasks) interruptAssistant(task, Math.max(task.updatedAt, Date.parse(record.at)));
	return validateAssistant(merged);
}
