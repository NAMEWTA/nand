import { DurableState } from '../../../shared/storage/durable-state';
import type { TextStorage } from '../../../shared/storage/ports';
import type { BrowserPageTarget } from '../core/control';
import { BrowserError } from '../core/model';
import type { SendAttempt } from '../core/workspace/model';

export interface JournalAttempt extends SendAttempt { taskId: string; turnId: string; exchangeId: string }
interface JournalData { version: 1; attempts: JournalAttempt[] }
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function decode(raw: unknown): JournalData {
	const data = raw as JournalData;
	const ids = new Set<string>();
	if (!data || data.version !== 1 || !Array.isArray(data.attempts)) throw new BrowserError('browser_workspace_journal');
	for (const row of data.attempts) {
		if (!row || !identifier(row.id) || ids.has(row.id) || !identifier(row.taskId) || !identifier(row.turnId) || !identifier(row.exchangeId)
			|| !row.expectedTarget || !identifier(row.expectedTarget.pageId) || !identifier(row.expectedTarget.profileId) || !identifier(row.expectedTarget.generation)
			|| !time(row.intentPersistedAt) || !/^[a-f\d]{64}$/.test(row.promptHash)
			|| !['intent', 'staged', 'dispatching', 'accepted', 'not-sent', 'unknown'].includes(row.outcome)
			|| (row.dispatchStartedAt !== undefined && !time(row.dispatchStartedAt)) || (row.finishedAt !== undefined && !time(row.finishedAt))
			|| (row.expectedConversationId !== undefined && !identifier(row.expectedConversationId))
			|| (row.acceptedMessageId !== undefined && !identifier(row.acceptedMessageId))
			|| (row.acceptedConversationId !== undefined && !identifier(row.acceptedConversationId))
			|| (row.acceptedParentId !== undefined && !identifier(row.acceptedParentId))
			|| (row.errorCode !== undefined && (typeof row.errorCode !== 'string' || !/^browser_[a-z_]+$/.test(row.errorCode)))
			|| (['dispatching', 'accepted', 'unknown'].includes(row.outcome) && row.dispatchStartedAt === undefined)
			|| (row.dispatchStartedAt !== undefined && row.dispatchStartedAt < row.intentPersistedAt)
			|| (row.finishedAt !== undefined && row.finishedAt < (row.dispatchStartedAt ?? row.intentPersistedAt))
			|| (row.outcome === 'accepted' && (!row.acceptedMessageId || !row.acceptedConversationId || row.finishedAt === undefined))) throw new BrowserError('browser_workspace_journal');
		ids.add(row.id);
	}
	return data;
}

/** Durable intent and submission facts only. Questions and answers belong to visible Markdown documents. */
export class WorkspaceJournal {
	private readonly repository: DurableState<JournalData>;
	private edits: Promise<unknown> = Promise.resolve();
	readonly ready: Promise<void>;
	constructor(storage: TextStorage, path: string, private readonly changed: () => void) {
		this.repository = new DurableState(storage, path, () => ({ version: 1, attempts: [] }), decode, changed);
		this.ready = this.repository.sync(true);
		void this.ready.catch(() => undefined);
	}
	list(exchangeId?: string): JournalAttempt[] {
		return structuredClone(this.repository.value.attempts.filter(row => exchangeId === undefined || row.exchangeId === exchangeId));
	}
	/** Reload durable evidence; a failed reservation was rolled back and is never replayed here. */
	async refresh(): Promise<void> { await this.edits; await this.repository.sync(true); }
	private edit(change: (draft: JournalData) => void): Promise<void> {
		const next = this.edits.then(async () => {
			await this.ready; await this.repository.sync(true);
			const before = structuredClone(this.repository.value), draft = structuredClone(before);
			change(draft); decode(draft);
			this.repository.value = draft; this.repository.save();
			try { await this.repository.flush(); }
			catch (error) { this.repository.value = before; this.changed(); throw error; }
		});
		this.edits = next.catch(() => undefined);
		return next;
	}
	/** A resend must name the exact previous attempt reviewed by the caller. */
	reserve(input: { id: string; taskId: string; turnId: string; exchangeId: string; target: BrowserPageTarget; conversationId?: string; promptHash: string; at: number; retryOf?: string }): Promise<void> {
		const frozen = structuredClone(input);
		return this.edit(draft => {
			const previous = draft.attempts.filter(row => row.exchangeId === frozen.exchangeId).at(-1);
			if (previous && (previous.taskId !== frozen.taskId || previous.turnId !== frozen.turnId || previous.promptHash !== frozen.promptHash || previous.expectedTarget.profileId !== frozen.target.profileId))
				throw new BrowserError('browser_workspace_attempt_changed');
			if (previous && (frozen.retryOf !== previous.id || ['intent', 'staged', 'dispatching'].includes(previous.outcome)))
				throw new BrowserError('browser_workspace_retry_review');
			if (!previous && frozen.retryOf) throw new BrowserError('browser_workspace_retry_review');
			draft.attempts.push({ id: frozen.id, taskId: frozen.taskId, turnId: frozen.turnId, exchangeId: frozen.exchangeId,
				expectedTarget: frozen.target, expectedConversationId: frozen.conversationId, promptHash: frozen.promptHash,
				intentPersistedAt: frozen.at, outcome: 'intent' });
		});
	}
	private transition(id: string, from: readonly SendAttempt['outcome'][], change: (attempt: JournalAttempt) => void): Promise<void> {
		return this.edit(draft => {
			const row = draft.attempts.find(row => row.id === id);
			if (!row || !from.includes(row.outcome) || draft.attempts.filter(next => next.exchangeId === row.exchangeId).at(-1)?.id !== id)
				throw new BrowserError('browser_workspace_attempt_changed');
			change(row);
		});
	}
	staged(id: string): Promise<void> { return this.transition(id, ['intent'], row => { row.outcome = 'staged'; }); }
	dispatching(id: string, at: number): Promise<void> {
		return this.transition(id, ['staged'], row => { row.outcome = 'dispatching'; row.dispatchStartedAt = at; });
	}
	accepted(id: string, message: { messageId: string; conversationId: string; parentId?: string }, at: number): Promise<void> {
		const frozen = { ...message };
		return this.transition(id, ['dispatching', 'unknown'], row => {
			row.outcome = 'accepted'; row.acceptedMessageId = frozen.messageId; row.acceptedConversationId = frozen.conversationId;
			row.acceptedParentId = frozen.parentId; row.finishedAt = at; delete row.errorCode;
		});
	}
	finish(id: string, outcome: 'not-sent' | 'unknown', at: number, errorCode: string): Promise<void> {
		return this.transition(id, outcome === 'unknown' ? ['dispatching'] : ['intent', 'staged', 'dispatching'], row => {
			row.outcome = outcome; row.finishedAt = at; row.errorCode = errorCode;
		});
	}
	/** Only dispatching records become unknown. Interrupted staged drafts require a separate page review. */
	async recover(): Promise<void> {
		await this.ready;
		if (this.list().some(row => row.outcome === 'dispatching'))
			await this.edit(draft => { for (const row of draft.attempts) if (row.outcome === 'dispatching') { row.outcome = 'unknown'; row.errorCode = 'browser_workspace_interrupted'; } });
	}
	async shutdown(): Promise<void> { await this.edits; await this.repository.shutdown(); }
}
