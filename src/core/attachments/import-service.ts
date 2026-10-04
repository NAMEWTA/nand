import {
	AttachmentError,
	type AttachmentFilePort,
	type AttachmentImportOutcome,
	type AttachmentImportRequest,
	type AttachmentImportResult,
	type AttachmentImportStage,
	type AttachmentName,
} from './model';
import { attachmentName, attachmentTimestamp } from './naming';
import { resolveAttachmentDirectory } from './path-policy';

interface PreparedItem {
	readonly id: string;
	readonly directory: string;
	readonly candidate: (sequence: number) => AttachmentName;
	readonly readBytes: () => Promise<ArrayBuffer>;
}

type PlanItem = { readonly id: string; readonly prepared: PreparedItem }
	| { readonly id: string; readonly error: unknown };

function prepare(request: AttachmentImportRequest): PlanItem[] {
	const timestamp = attachmentTimestamp(request.nowMs);
	const ids = new Set<string>();
	for (const item of request.items) {
		if (!item.id || ids.has(item.id)) throw new AttachmentError('invalid-batch', item.id);
		ids.add(item.id);
	}
	return request.items.map((item): PlanItem => {
		const { id, extension, customName = '', readBytes } = item;
		try {
			const { directory } = resolveAttachmentDirectory(request.notePath, request.policy, item.directoryTemplate);
			// Validate before IO; capture values rather than a mutable settings object.
			attachmentName(timestamp, extension, customName);
			return { id, prepared: { id, directory, readBytes,
				candidate: (sequence) => attachmentName(timestamp, extension, customName, sequence) } };
		} catch (error) {
			return { id, error };
		}
	});
}

function summarize(items: readonly AttachmentImportOutcome[]): AttachmentImportResult {
	const created = items.filter((item) => item.status === 'created').length;
	const cancelled = items.filter((item) => item.status === 'cancelled').length;
	const status = created === items.length ? 'completed' : created > 0 ? 'partial'
		: cancelled === items.length ? 'cancelled' : 'failed';
	return { status, items };
}

/**
 * One instance belongs to one App/Vault. It serializes accepted batches, not the world.
 * The platform port must implement non-overwriting creation and classify collisions.
 * File writes and subsequent editor insertion are explicitly separate operations.
 */
export class AttachmentImportService {
	private readonly files: AttachmentFilePort;
	private readonly collisionLimit: number;
	private tail: Promise<void> = Promise.resolve();
	private accepting = true;

	constructor(files: AttachmentFilePort, collisionLimit = 10000) {
		if (!Number.isSafeInteger(collisionLimit) || collisionLimit < 1) {
			throw new AttachmentError('invalid-sequence');
		}
		this.files = files;
		this.collisionLimit = collisionLimit;
	}

	async importBatch(request: AttachmentImportRequest, cancelled: () => boolean = () => false): Promise<AttachmentImportResult> {
		if (!this.accepting || cancelled()) {
			return summarize(request.items.map(({ id }) => ({ id, status: 'cancelled' })));
		}
		const plan = prepare(request);
		const run = this.tail.then(() => this.execute(plan, cancelled));
		// Rejection must not poison later batches; the caller still owns the original run.
		this.tail = run.then(() => undefined, () => undefined);
		return run;
	}

	/** Seal synchronously. In-progress creation is allowed to settle and is reported. */
	stop(): Promise<void> {
		this.accepting = false;
		return this.tail;
	}

	drain(): Promise<void> {
		return this.tail;
	}

	private async execute(plan: readonly PlanItem[], cancelled: () => boolean): Promise<AttachmentImportResult> {
		const results: AttachmentImportOutcome[] = [];
		for (const item of plan) {
			if (!this.accepting || cancelled()) {
				results.push({ id: item.id, status: 'cancelled' });
				continue;
			}
			if ('error' in item) {
				results.push({ id: item.id, status: 'failed', stage: 'prepare', error: item.error });
				continue;
			}
			results.push(await this.importItem(item.prepared, cancelled));
		}
		return summarize(results);
	}

	private async importItem(item: PreparedItem, cancelled: () => boolean): Promise<AttachmentImportOutcome> {
		let stage: AttachmentImportStage = 'read';
		const stopped = () => !this.accepting || cancelled();
		try {
			const bytes = await item.readBytes();
			if (stopped()) return { id: item.id, status: 'cancelled' };
			stage = 'directory';
			if (item.directory) await this.files.ensureDirectory(item.directory);
			if (stopped()) return { id: item.id, status: 'cancelled' };
			stage = 'create';
			for (let sequence = 0; sequence < this.collisionLimit; sequence++) {
				if (stopped()) return { id: item.id, status: 'cancelled' };
				const name = item.candidate(sequence);
				const path = item.directory ? `${item.directory}/${name.filename}` : name.filename;
				const result: unknown = await this.files.createNewBinary(path, bytes);
				if (result === 'created') {
					return { id: item.id, status: 'created', path, warnings: name.warnings };
				}
				// Only an explicit 'exists' result advances to another name. IO errors reject.
				if (result !== 'exists') throw new AttachmentError('invalid-create-result', path);
			}
			throw new AttachmentError('name-space-exhausted', item.directory);
		} catch (error) {
			return { id: item.id, status: 'failed', stage, error };
		}
	}
}
