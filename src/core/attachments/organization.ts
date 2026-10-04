import { normalizeAttachmentVaultPath } from './path-policy';

export interface AttachmentReferenceSnapshot {
	/** Incomplete queries must never authorize deleting or moving the source. */
	readonly complete: boolean;
	readonly notePaths: readonly string[];
}

export interface AttachmentRelocationDecision {
	readonly action: 'keep' | 'copy' | 'move';
	readonly reason: 'same-path' | 'shared-reference' | 'incomplete-references' | 'not-owned' | 'exclusive-reference';
}

/** Individual-file decision only. There is deliberately no "move assets folder" action. */
export function attachmentRelocationDecision(
	ownerNotePath: string,
	sourcePath: string,
	targetPath: string,
	references: AttachmentReferenceSnapshot,
): AttachmentRelocationDecision {
	if (normalizeAttachmentVaultPath(sourcePath) === normalizeAttachmentVaultPath(targetPath)) {
		return { action: 'keep', reason: 'same-path' };
	}
	if (!references.complete) return { action: 'copy', reason: 'incomplete-references' };
	const owner = normalizeAttachmentVaultPath(ownerNotePath);
	const notes = new Set(references.notePaths.map(normalizeAttachmentVaultPath));
	if (!notes.has(owner)) return { action: 'copy', reason: 'not-owned' };
	if (notes.size > 1) return { action: 'copy', reason: 'shared-reference' };
	return { action: 'move', reason: 'exclusive-reference' };
}
