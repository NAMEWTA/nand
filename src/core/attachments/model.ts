/** Attachment domain contracts. No Obsidian, DOM or filesystem implementations. */
export type AttachmentErrorCode =
	| 'invalid-path'
	| 'path-outside-vault'
	| 'protected-path'
	| 'invalid-template'
	| 'invalid-note'
	| 'invalid-name'
	| 'invalid-extension'
	| 'invalid-timestamp'
	| 'invalid-sequence'
	| 'name-space-exhausted'
	| 'invalid-batch'
	| 'invalid-create-result';

/** Codes are translated by the owning UI; native errors remain available as causes. */
export class AttachmentError extends Error {
	readonly code: AttachmentErrorCode;
	readonly detail: string;

	constructor(code: AttachmentErrorCode, detail = '') {
		super(detail ? `${code}: ${detail}` : code);
		this.name = 'AttachmentError';
		this.code = code;
		this.detail = detail;
	}
}

export interface AttachmentPathPolicy {
	/** Relative to the originating note. The only template variable is {note}. */
	readonly defaultTemplate: string;
	readonly noteOverrides: Readonly<Record<string, string>>;
	/** Keys are canonical Vault directory paths; the root is an empty string. */
	readonly folderOverrides: Readonly<Record<string, string>>;
}

export const DEFAULT_ATTACHMENT_PATH_POLICY: AttachmentPathPolicy = Object.freeze({
	defaultTemplate: 'assets',
	noteOverrides: Object.freeze({}),
	folderOverrides: Object.freeze({}),
});

export interface ResolvedAttachmentDirectory {
	readonly directory: string;
	readonly template: string;
	readonly source: 'item' | 'note' | 'folder' | 'default';
	readonly matchedPath: string | null;
}

export type AttachmentNameWarning = 'name-sanitized' | 'duplicate-extension-removed' | 'name-truncated';

export interface AttachmentName {
	readonly filename: string;
	readonly warnings: readonly AttachmentNameWarning[];
}

export interface AttachmentInput {
	readonly id: string;
	/** The adapter determines the real type; renaming is never a file conversion. */
	readonly extension: string;
	readonly customName?: string;
	readonly directoryTemplate?: string;
	readonly readBytes: () => Promise<ArrayBuffer>;
}

export interface AttachmentImportRequest {
	readonly notePath: string;
	/** Capture at the user action, not when a queued write eventually starts. */
	readonly nowMs: number;
	readonly policy: AttachmentPathPolicy;
	readonly items: readonly AttachmentInput[];
}

export interface AttachmentFilePort {
	/** Return normally for an existing directory; reject other IO failures. */
	ensureDirectory(path: string): Promise<void>;
	/** Never overwrite. Only a confirmed name collision returns 'exists'. */
	createNewBinary(path: string, data: ArrayBuffer): Promise<'created' | 'exists'>;
}

export type AttachmentImportStage = 'prepare' | 'read' | 'directory' | 'create';
export type AttachmentImportOutcome =
	| { readonly id: string; readonly status: 'created'; readonly path: string; readonly warnings: readonly AttachmentNameWarning[] }
	| { readonly id: string; readonly status: 'failed'; readonly stage: AttachmentImportStage; readonly error: unknown }
	| { readonly id: string; readonly status: 'cancelled' };

export interface AttachmentImportResult {
	readonly status: 'completed' | 'partial' | 'failed' | 'cancelled';
	/** Input order is retained, including failures and cancellations. */
	readonly items: readonly AttachmentImportOutcome[];
}
