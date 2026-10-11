import type { App } from 'obsidian';
import { deviceId } from '../../../host/obsidian/storage/device-id';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
import { decodeWorkspaceRecovery, mergeWorkspaceRecovery, type WorkspaceRecoveryDraft, type WorkspaceRecoveryReview } from '../core/workspace/recovery';
import { snapshotJson } from '../core/workspace/snapshot';
import { markdownWorkspaceStore, workspaceDocumentKey } from './workspace-store';

/** Only this device/folder's recovery directory is listed. Each runtime keeps its own snapshot file. */
export async function workspaceRecoveryDirectory(app: App, root: string): Promise<string> {
	const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(root)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
	return `.nand/recovery/drafts/browser-${deviceId(app)}-${hash}`;
}

export async function readWorkspaceRecovery(app: App, root: string, draftId?: string): Promise<{ review: WorkspaceRecoveryReview; record?: WorkspaceRecoveryDraft }> {
	const directory = await workspaceRecoveryDirectory(app, root), storage = privateVaultStorage(app);
	const review: WorkspaceRecoveryReview = { id: crypto.randomUUID(), file: directory, canRestore: false, unchanged: false, drafts: [] };
	const store = markdownWorkspaceStore(app, root, () => {});
	try { await store.ready; review.local = store.data(); }
	catch { review.error = 'browser_workspace_recovery_local_invalid'; }
	finally { await store.shutdown().catch(() => undefined); }
	let record: WorkspaceRecoveryDraft | undefined;
	try {
		const files = await storage.exists(directory) ? (await app.vault.adapter.list(directory)).files : [];
		for (const file of files) {
			if (!file.startsWith(directory + '/')) continue;
			const name = file.slice(directory.length + 1), match = /^([a-f\d-]{36})\.json$/i.exec(name); if (!match) continue;
			const id = match[1]!;
			try {
				const candidate = decodeWorkspaceRecovery(JSON.parse(await storage.read(file)), workspaceDocumentKey(root));
				review.drafts.push({ id, at: candidate.at, captures: candidate.draft.exchanges.reduce((sum, exchange) => sum + exchange.captures.length + Number(!!exchange.imported), candidate.draft.syntheses.length) });
				if (id === draftId) { record = candidate; review.draftId = id; review.file = file; review.at = record.at; review.draft = record.draft; }
			} catch {
				review.drafts.push({ id, captures: 0 });
				if (id === draftId) { review.file = file; review.error = 'browser_workspace_recovery_invalid'; }
			}
		}
		if (draftId && !review.drafts.some(draft => draft.id === draftId)) review.error = 'browser_workspace_recovery_invalid';
	} catch { review.error = 'browser_workspace_recovery_invalid'; }
	review.drafts.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
	if (record && review.local) {
		try {
			review.unchanged = snapshotJson(mergeWorkspaceRecovery(record, review.local)) === snapshotJson(review.local);
			review.canRestore = !review.unchanged;
		} catch { review.error = 'browser_workspace_recovery_conflict'; }
	}
	return { review, record };
}
