import { threeWayMerge } from '../../../../shared/storage/three-way-merge';
import { BrowserError } from '../model';
import { validateWorkspace } from './documents';
import type { WorkspaceData } from './model';
import { synthesisMaterial } from './synthesis';

export interface WorkspaceRecoveryDraft { path: string; at: string; baseline: WorkspaceData; draft: WorkspaceData }
export interface WorkspaceRecoveryReview {
	id: string; file: string; at?: string; local?: WorkspaceData; draft?: WorkspaceData;
	draftId?: string; drafts: Array<{ id: string; at?: string; captures: number }>;
	canRestore: boolean; unchanged: boolean; error?: string;
}

export function recoveryDocuments(data: WorkspaceData): WorkspaceData {
	const result = structuredClone(validateWorkspace(data));
	for (const exchange of result.exchanges) exchange.attempts = [];
	return result;
}

/** Only the exact configured workspace key can supply recovery data. Runtime send attempts are never imported. */
export function decodeWorkspaceRecovery(raw: unknown, key: string): WorkspaceRecoveryDraft {
	const value = raw as WorkspaceRecoveryDraft;
	if (!value || value.path !== key || typeof value.at !== 'string' || !Number.isFinite(Date.parse(value.at)))
		throw new BrowserError('browser_workspace_recovery_invalid');
	const baseline = recoveryDocuments(value.baseline), draft = recoveryDocuments(value.draft);
	return { path: key, at: value.at, baseline, draft };
}

/** Preserves current edits and deletions; a conflict requires manual review, never replacement with a backup. */
export function mergeWorkspaceRecovery(record: WorkspaceRecoveryDraft, current: WorkspaceData): WorkspaceData {
	const base = recoveryDocuments(record.baseline), local = recoveryDocuments(record.draft), remote = recoveryDocuments(current);
	// Restart may mark an unfinished acquisition interrupted. Those derived statuses must not conflict with
	// an answer already captured into recovery; current document edits and immutable message data still do.
	const derived = ['submitState', 'acquisitionState', 'saveState', 'lastError', 'currentCaptureId'] as const;
	for (const data of [base, local]) for (const exchange of data.exchanges) {
		const saved = remote.exchanges.find(row => row.id === exchange.id); if (!saved) continue;
		for (const key of derived) {
			if (saved[key] === undefined) delete exchange[key];
			else Object.assign(exchange, { [key]: saved[key] });
		}
	}
	// A persisted pending intent becomes interrupted on restart. A completed recovery result
	// still belongs to that intent; normalize only this derived transition before merging.
	for (const synthesis of base.syntheses) {
		const saved = remote.syntheses.find(row => row.id === synthesis.id);
		const recovered = local.syntheses.find(row => row.id === synthesis.id);
		if (saved && recovered && synthesisMaterial(saved) !== synthesisMaterial(recovered)
			&& (recovered.status !== synthesis.status || recovered.text !== synthesis.text)) throw new BrowserError('browser_workspace_recovery_conflict');
		if (saved?.status === 'interrupted' && ['pending', 'running', 'needs-attention'].includes(synthesis.status)) {
			synthesis.status = 'interrupted'; synthesis.updatedAt = saved.updatedAt;
		}
	}
	const merged = threeWayMerge(base, local, remote);
	for (const exchange of merged.exchanges) {
		const capture = exchange.captures.at(-1), saved = remote.exchanges.find(row => row.id === exchange.id);
		exchange.currentCaptureId = capture?.id;
		if (capture && capture.id !== saved?.currentCaptureId) {
			exchange.acquisitionState = capture.complete ? 'complete' : 'incomplete'; exchange.saveState = 'saved'; delete exchange.lastError;
		}
	}
	return validateWorkspace(merged);
}
