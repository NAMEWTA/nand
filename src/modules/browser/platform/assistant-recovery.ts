import type { App } from 'obsidian';
import { deviceId } from '../../../host/obsidian/storage/device-id';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
import { decodeAssistantRecovery, mergeAssistantRecovery, type AssistantRecoveryDraft, type AssistantRecoveryReview } from '../core/assistant/recovery';
import { snapshotJson } from '../core/workspace/snapshot';
import { assistantDocumentKey, markdownAssistantStore } from './assistant-store';

export async function assistantRecoveryDirectory(app: App, folder: string): Promise<string> {
	const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(folder)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
	return `.nand/recovery/drafts/browser-assistant-${deviceId(app)}-${hash}`;
}
/** Independent reader remains available even when the primary task documents cannot initialize. */
export async function readAssistantRecovery(app: App, folder: string, draftId?: string): Promise<{ review: AssistantRecoveryReview; record?: AssistantRecoveryDraft }> {
	const directory = await assistantRecoveryDirectory(app, folder), storage = privateVaultStorage(app);
	const review: AssistantRecoveryReview = { id: crypto.randomUUID(), file: directory, canRestore: false, unchanged: false, drafts: [] };
	const store = markdownAssistantStore(app, folder, directory, () => {});
	try { await store.ready; review.local = store.data(); }
	catch { review.error = 'browser_workspace_recovery_local_invalid'; }
	finally { await store.shutdown().catch(() => undefined); }
	let record: AssistantRecoveryDraft | undefined;
	try {
		const files = await storage.exists(directory) ? (await app.vault.adapter.list(directory)).files : [];
		for (const file of files) {
			if (!file.startsWith(directory + '/')) continue;
			const match = /^([a-f\d-]{36})\.json$/i.exec(file.slice(directory.length + 1)); if (!match) continue;
			const id = match[1]!;
			try {
				const candidate = decodeAssistantRecovery(JSON.parse(await storage.read(file)), assistantDocumentKey(folder));
				review.drafts.push({ id, at: candidate.at, tasks: candidate.draft.tasks.length });
				if (id === draftId) { record = candidate; review.draftId = id; review.file = file; review.at = candidate.at; review.draft = candidate.draft; }
			} catch {
				review.drafts.push({ id, tasks: 0 }); if (id === draftId) review.error = 'browser_workspace_recovery_invalid';
			}
		}
		if (draftId && !record) review.error = 'browser_workspace_recovery_invalid';
	} catch { review.error = 'browser_workspace_recovery_invalid'; }
	review.drafts.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
	if (record && review.local) {
		try { review.unchanged = snapshotJson(mergeAssistantRecovery(record, review.local)) === snapshotJson(review.local); review.canRestore = !review.unchanged; }
		catch { review.error = 'browser_workspace_recovery_conflict'; }
	}
	return { review, record };
}
