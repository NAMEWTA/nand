import { BrowserError } from '../core/model';
import type { AcceptedMessage, ProviderFactory, ProviderReadiness, ProviderSession } from '../core/providers/contracts';
import { verifyAccepted, verifyCapture, verifyReadiness, verifyStaged } from '../core/providers/verification';
import { officialConversationUrl } from '../core/providers/official-url';
import { snapshotJson } from '../core/workspace/snapshot';
import { applyCapture, recoverExchange, retryContext, type TargetBinding, type WorkspaceData, type WorkspaceExchange, type WorkspaceTurn } from '../core/workspace/model';
import type { WorkspaceJournal } from '../platform/workspace-journal';
import type { WorkspaceStore } from '../platform/workspace-store';

interface SendRow { binding: TargetBinding; exchange: WorkspaceExchange; session: ProviderSession; before: ProviderReadiness; staged?: ProviderReadiness; attemptId?: string; stagingStarted: boolean; dispatched: boolean; message?: AcceptedMessage }
interface SenderPorts { store: WorkspaceStore; journal: WorkspaceJournal; providers: ProviderFactory; changed(): void; id(): string; now(): number; hash(text: string): Promise<string> }
interface ReviewedRetry { exchangeId: string; source: string | undefined }
const errorCode = (error: unknown): string => error instanceof BrowserError && /^browser_[a-z_]+$/.test(error.code) ? error.code : 'browser_workspace_operation_failed';
const check = (signal: AbortSignal): void => { if (signal.aborted) throw new BrowserError('browser_workspace_paused'); };

/** Owns send operations, never the active browser page. Saving and collecting cannot dispatch a prompt. */
export class WorkspaceSender {
	private readonly runs = new Map<string, { abort: AbortController; done: Promise<void> }>();
	private readonly owners = new Set<string>();
	private readonly facts = new Map<string, WorkspaceExchange>();
	private saves: Promise<unknown> = Promise.resolve();
	private closed = false;
	constructor(private readonly ports: SenderPorts) {}
	busy(taskId: string): boolean { return this.runs.has(taskId); }
	data(): WorkspaceData {
		const data = this.ports.store.data();
		data.exchanges = data.exchanges.map(exchange => {
			const next = structuredClone(this.facts.get(exchange.id) ?? exchange);
			next.attempts = this.ports.journal.list(exchange.id);
			return next;
		});
		return data;
	}
	private publish(exchange: WorkspaceExchange): void {
		const fact = structuredClone(exchange);
		if (this.ports.store.hasPendingSave() || this.facts.get(exchange.id)?.saveState === 'failed') fact.saveState = 'failed';
		this.facts.set(exchange.id, fact); this.ports.changed();
	}
	private saveFacts(): Promise<void> {
		const next = this.saves.then(async () => {
			if (!this.facts.size) return;
			const pending = [...this.facts.entries()];
			const update = (data: WorkspaceData) => {
				for (const [id, fact] of pending) {
					const index = data.exchanges.findIndex(row => row.id === id);
					if (index < 0 || data.exchanges[index]!.turnId !== fact.turnId) throw new BrowserError('browser_workspace_storage_changed');
					data.exchanges[index] = { ...structuredClone(fact), saveState: 'saved' };
					const turn = data.turns.find(turn => turn.id === fact.turnId), attempt = this.ports.journal.list(fact.id).find(row => row.id === fact.receipt?.attemptId);
					const binding = data.tasks.find(task => task.id === turn?.taskId)?.targets.find(target => target.id === fact.targetId);
					if (fact.receipt && binding && attempt && snapshotJson(binding.page) === snapshotJson(attempt.expectedTarget)
						&& binding.conversationId === attempt.expectedConversationId) {
						binding.conversationId = fact.receipt.conversationId;
						binding.officialUrl = officialConversationUrl(binding.provider, fact.receipt.conversationId) ?? binding.officialUrl;
					}
				}
			};
			try {
				if (this.ports.store.hasPendingSave()) {
					await this.ports.store.retainPending(update);
					throw new BrowserError('browser_workspace_save_pending');
				}
				await this.ports.store.edit(update);
			} catch (error) {
				for (const [id] of pending) {
					const current = this.facts.get(id);
					if (current) this.facts.set(id, { ...current, saveState: 'failed' });
				}
				this.ports.changed(); throw error;
			}
			for (const [id, fact] of pending) if (this.facts.get(id) === fact) this.facts.delete(id);
			this.ports.changed();
		});
		this.saves = next.catch(() => undefined); return next;
	}
	/** Recovery reports evidence. It never stages, dispatches, or silently resumes acquisition. */
	async recover(): Promise<void> {
		await Promise.all([this.ports.store.ready, this.ports.journal.ready]);
		await this.ports.journal.recover();
		for (const exchange of this.data().exchanges) {
			const next = recoverExchange(exchange), attempt = next.attempts.at(-1);
			if (attempt?.outcome === 'accepted') {
				next.receipt = { attemptId: attempt.id, conversationId: attempt.acceptedConversationId!, messageId: attempt.acceptedMessageId!, parentId: attempt.acceptedParentId };
				next.submitState = 'submitted';
			} else if (next.receipt && (!attempt || next.receipt.attemptId === attempt.id)) next.submitState = 'submitted';
			if (next.receipt && ['idle', 'waiting', 'collecting'].includes(next.acquisitionState)) {
				next.acquisitionState = 'incomplete'; next.lastError = 'browser_workspace_interrupted';
			}
			if (snapshotJson(next) !== snapshotJson(exchange)) this.publish(next);
		}
		await this.saveFacts();
	}
	/** Only already-persisted turns can reach the native driver; a turn is never implicitly retried. */
	send(turnId: string): Promise<void> {
		if (this.closed) return Promise.reject(new BrowserError('browser_disabled'));
		const data = this.data(), turn = data.turns.find(row => row.id === turnId);
		if (!turn) return Promise.reject(new BrowserError('browser_workspace_turn_missing'));
		if (this.runs.has(turn.taskId)) return Promise.reject(new BrowserError('browser_workspace_busy'));
		const abort = new AbortController();
		const done = this.run(structuredClone(turn), abort.signal).finally(() => { this.runs.delete(turn.taskId); this.ports.changed(); });
		this.runs.set(turn.taskId, { abort, done }); this.ports.changed(); return done;
	}
	pause(taskId: string): void { this.runs.get(taskId)?.abort.abort(); }
	/** The workspace has reviewed this exact exchange/binding snapshot, not the whole group. */
	async retrySend(exchangeId: string, source: string | undefined): Promise<void> {
		if (this.closed) return Promise.reject(new BrowserError('browser_disabled'));
		const context = retryContext(this.data(), exchangeId);
		if (snapshotJson(context) !== source) return Promise.reject(new BrowserError('browser_workspace_preview_changed'));
		const taskId = context.turn.taskId;
		if (this.runs.has(taskId)) return Promise.reject(new BrowserError('browser_workspace_busy'));
		const abort = new AbortController();
		const done = this.run(structuredClone(context.turn), abort.signal, { exchangeId, source }).finally(() => { this.runs.delete(taskId); this.ports.changed(); });
		this.runs.set(taskId, { abort, done }); this.ports.changed(); return done;
	}
	/** Collects only the message named by a confirmed receipt; this path cannot create a send attempt. */
	recollect(exchangeId: string): Promise<void> {
		if (this.closed) return Promise.reject(new BrowserError('browser_disabled'));
		const data = this.data(), exchange = data.exchanges.find(row => row.id === exchangeId), turn = data.turns.find(row => row.id === exchange?.turnId);
		if (!exchange || !turn) return Promise.reject(new BrowserError('browser_workspace_answer_missing'));
		if (this.runs.has(turn.taskId)) return Promise.reject(new BrowserError('browser_workspace_busy'));
		const abort = new AbortController();
		const done = this.collectAgain(exchangeId, turn.taskId, abort.signal).finally(() => { this.runs.delete(turn.taskId); this.ports.changed(); });
		this.runs.set(turn.taskId, { abort, done }); this.ports.changed(); return done;
	}
	private async collectAgain(exchangeId: string, taskId: string, signal: AbortSignal): Promise<void> {
		const { store, providers } = this.ports;
		await store.refresh(); check(signal);
		if (store.hasPendingSave() || this.facts.size) throw new BrowserError('browser_workspace_save_pending');
		const data = this.data(), exchange = data.exchanges.find(row => row.id === exchangeId), turn = data.turns.find(row => row.id === exchange?.turnId);
		const receipt = exchange?.receipt, binding = data.tasks.find(row => row.id === taskId)?.targets.find(row => row.id === exchange?.targetId);
		const original = turn?.targets.find(row => row.id === exchange?.targetId);
		if (!exchange || !turn || !receipt || exchange.submitState !== 'submitted') throw new BrowserError('browser_workspace_submission_identity');
		if (!binding?.page || !original || binding.provider !== original.provider || binding.profileId !== original.profileId || binding.conversationId !== receipt.conversationId)
			throw new BrowserError('browser_workspace_identity_changed');
		const session = await providers.connect(structuredClone(binding), taskId, signal);
		try {
			check(signal); const readiness = await session.inspect(signal); check(signal);
			if (!['ready', 'generating'].includes(readiness.state)) throw new BrowserError('browser_workspace_target_not_ready');
			// Reading a generating answer or a page with a human draft is allowed; writing is not.
			verifyReadiness(binding, { ...readiness, state: 'ready' });
			if (!readiness.messageIds.includes(receipt.messageId)) throw new BrowserError('browser_workspace_message_identity');
			exchange.acquisitionState = 'collecting'; this.publish(exchange);
			let result = exchange;
			try {
				const message: AcceptedMessage = { conversationId: receipt.conversationId, messageId: receipt.messageId, parentId: receipt.parentId, text: turn.finalPrompt };
				const observed = await session.capture(message, signal);
				const capture = signal.aborted ? { ...observed, complete: false, reasons: [...new Set([...observed.reasons, 'interrupted'])] } : observed;
				verifyCapture(capture, message);
				result = applyCapture(exchange, { ...structuredClone(capture), id: this.ports.id(), exchangeId,
					revision: (exchange.captures.at(-1)?.revision ?? 0) + 1, capturedAt: this.ports.now() });
				delete result.lastError;
			} catch (error) { result.acquisitionState = 'incomplete'; result.lastError = errorCode(error); }
			this.publish(result); await this.saveFacts();
		} finally { session.dispose(); }
	}
	private async run(turn: WorkspaceTurn, signal: AbortSignal, retry?: ReviewedRetry): Promise<void> {
		const { store, journal, providers } = this.ports, rows: SendRow[] = [], acquired: string[] = [];
		try {
			await Promise.all([store.ready, journal.ready]); await Promise.all([store.refresh(), journal.refresh()]); check(signal);
			if (store.hasPendingSave() || this.facts.size) throw new BrowserError('browser_workspace_save_pending');
			const data = this.data(), persisted = data.turns.find(row => row.id === turn.id);
			if (snapshotJson(persisted) !== snapshotJson(turn)) throw new BrowserError('browser_workspace_storage_changed');
			const reviewed = retry && retryContext(data, retry.exchangeId);
			if (reviewed && snapshotJson(reviewed) !== retry.source) throw new BrowserError('browser_workspace_preview_changed');
			for (const binding of reviewed ? [reviewed.binding] : turn.targets) {
				const exchange = data.exchanges.find(row => row.turnId === turn.id && row.targetId === binding.id);
				if (!binding.page || !exchange || (reviewed ? exchange.id !== reviewed.exchange.id : exchange.attempts.length || exchange.receipt || exchange.submitState !== 'idle'))
					throw new BrowserError('browser_workspace_retry_review');
				const key = `${binding.profileId}:${binding.page.pageId}`;
				if (this.owners.has(key)) throw new BrowserError('browser_workspace_busy');
				this.owners.add(key); acquired.push(key);
				check(signal); const session = await providers.connect(structuredClone(binding), turn.taskId, signal);
				try {
					check(signal); const before = await session.inspect(signal); verifyReadiness(binding, before);
					if (before.draft !== '') throw new BrowserError('browser_workspace_draft_changed');
					rows.push({ binding, exchange, session, before, stagingStarted: false, dispatched: false });
				} catch (error) { session.dispose(); throw error; }
			}
			const promptHash = await this.ports.hash(turn.finalPrompt);
			// Flush every selected target's intent before the first input mutation.
			for (const row of rows) {
				check(signal); const attemptId = this.ports.id();
				const previous = retry ? row.exchange.attempts.at(-1) : undefined;
				if (previous && ['intent', 'staged'].includes(previous.outcome)) {
					await journal.finish(previous.id, 'not-sent', this.ports.now(), 'browser_workspace_interrupted'); check(signal);
				}
				await journal.reserve({ id: attemptId, taskId: turn.taskId, turnId: turn.id, exchangeId: row.exchange.id,
					target: row.binding.page!, conversationId: row.binding.conversationId, promptHash, at: this.ports.now(), retryOf: previous?.id });
				row.attemptId = attemptId;
				if (retry) { row.exchange.acquisitionState = 'idle'; delete row.exchange.lastError; }
			}
			for (const row of rows) {
				check(signal); row.exchange.submitState = 'staging'; this.publish(row.exchange);
				row.stagingStarted = true;
				row.staged = await row.session.stage(turn.finalPrompt, structuredClone(row.before), signal);
				verifyStaged(row.binding, row.before, row.staged, turn.finalPrompt);
				await journal.staged(row.attemptId!); row.exchange.submitState = 'staged'; this.publish(row.exchange);
			}
			await this.saveFacts();
			// Dispatch all selected targets before waiting for any long answer acquisition.
			for (const row of rows) {
				check(signal);
				const fresh = await row.session.inspect(signal); verifyStaged(row.binding, row.before, fresh, turn.finalPrompt);
				await journal.dispatching(row.attemptId!, this.ports.now()); check(signal);
				row.dispatched = true; row.exchange.submitState = 'submitting'; this.publish(row.exchange);
				try {
					const result = await row.session.commit(turn.finalPrompt, fresh, signal);
					if (result.status === 'accepted') {
						verifyAccepted(result.message, fresh, turn.finalPrompt); row.message = structuredClone(result.message);
						row.exchange.receipt = { attemptId: row.attemptId!, conversationId: result.message.conversationId, messageId: result.message.messageId, parentId: result.message.parentId };
						row.exchange.submitState = 'submitted'; row.exchange.acquisitionState = 'waiting'; this.publish(row.exchange);
						await journal.accepted(row.attemptId!, result.message, this.ports.now());
					} else {
						row.exchange.submitState = result.status;
						row.exchange.lastError = result.status === 'unknown' ? 'browser_workspace_submission_unknown' : 'browser_workspace_not_sent';
						this.publish(row.exchange); await journal.finish(row.attemptId!, result.status, this.ports.now(), row.exchange.lastError);
					}
				} catch (error) {
					if (row.message) throw error; // A failed receipt write cannot undo known remote acceptance.
					row.exchange.submitState = 'unknown'; row.exchange.lastError = errorCode(error); this.publish(row.exchange);
					await journal.finish(row.attemptId!, 'unknown', this.ports.now(), row.exchange.lastError);
				}
				await this.saveFacts();
			}
			const acquisitions = await Promise.allSettled(rows.filter(row => row.message).map(async row => {
				try {
					check(signal); row.exchange.acquisitionState = 'collecting'; this.publish(row.exchange);
					const observed = await row.session.capture(row.message!, signal);
					const capture = signal.aborted ? { ...observed, complete: false, reasons: [...new Set([...observed.reasons, 'interrupted'])] } : observed;
					verifyCapture(capture, row.message!);
					row.exchange = applyCapture(row.exchange, { ...structuredClone(capture), id: this.ports.id(), exchangeId: row.exchange.id,
						revision: (row.exchange.captures.at(-1)?.revision ?? 0) + 1, capturedAt: this.ports.now() });
				} catch (error) { row.exchange.acquisitionState = 'incomplete'; row.exchange.lastError = errorCode(error); }
				this.publish(row.exchange);
				await this.saveFacts();
			}));
			// Every already-started collection drains, even when an earlier answer could only reach recovery storage.
			const failed = acquisitions.find((result): result is PromiseRejectedResult => result.status === 'rejected');
			if (failed) throw failed.reason;
		} catch (error) {
			// A fresh preflight can fail before any intent exists. Report every untouched recipient honestly.
			for (const exchange of this.data().exchanges.filter(row => row.turnId === turn.id && (!retry || row.id === retry.exchangeId) && row.submitState === 'idle' && !row.receipt && !row.attempts.length)) {
				exchange.submitState = signal.aborted ? 'paused' : 'not-sent'; exchange.lastError = errorCode(error); this.publish(exchange);
			}
			for (const row of rows) {
				if (!row.attemptId) continue;
				if (row.message) {
					row.exchange.submitState = 'submitted';
					if (['idle', 'waiting', 'collecting'].includes(row.exchange.acquisitionState)) row.exchange.acquisitionState = 'incomplete';
				}
				else if (!row.dispatched) row.exchange.submitState = signal.aborted ? 'paused' : 'not-sent';
				else if (row.exchange.submitState === 'submitting') row.exchange.submitState = 'unknown';
				row.exchange.lastError = errorCode(error); this.publish(row.exchange);
				const attempt = journal.list(row.exchange.id).at(-1);
				if (attempt && ['intent', 'staged', 'dispatching'].includes(attempt.outcome) && !row.message) {
					try { await journal.finish(attempt.id, row.dispatched ? 'unknown' : 'not-sent', this.ports.now(), errorCode(error)); }
					catch { /* Keep the durable uncertainty and the explicit pending facts. */ }
				}
			}
			try { await this.saveFacts(); } catch { /* Explicit save retry owns pending observations. */ }
			throw error;
		} finally {
			for (const row of rows) {
				try {
					if (!signal.aborted && !row.dispatched && row.stagingStarted)
						await row.session.rollback(turn.finalPrompt, AbortSignal.any([signal, AbortSignal.timeout(5000)]));
				}
				catch { /* The user's current draft is never forcibly replaced during cleanup. */ }
				finally { row.session.dispose(); }
			}
			for (const key of acquired) this.owners.delete(key);
		}
	}
	/** Disk-only retry, including a receipt observed before a journal write failed. */
	async retrySave(): Promise<void> {
		if (this.runs.size) throw new BrowserError('browser_workspace_busy');
		await this.ports.journal.refresh();
		await this.ports.store.retrySave();
		for (const exchange of this.data().exchanges) {
			const receipt = exchange.receipt, attempt = exchange.attempts.at(-1);
			if (receipt && attempt?.id === receipt.attemptId && ['dispatching', 'unknown'].includes(attempt.outcome))
				await this.ports.journal.accepted(attempt.id, receipt, this.ports.now());
		}
		await this.saveFacts();
	}
	async shutdown(): Promise<void> {
		this.closed = true;
		for (const run of this.runs.values()) run.abort.abort();
		await Promise.allSettled([...this.runs.values()].map(run => run.done)); await this.saves;
	}
}
