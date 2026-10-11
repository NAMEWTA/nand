import type { AgentPromptResult } from '../../agent/api';
import type { ResumableAnalysis } from '../core/analysis-run';
import type { NewsAnalysis, NewsMaterial, NewsRun, NewsRunReceipt } from '../core/model';

export function newsLocalDay(now = Date.now()): string {
	const date = new Date(now);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const PRE_SEND_ERRORS = new Set(['cliMissing', 'agentDisabled', 'cwdInvalid', 'permissionRequired', 'promptTooLarge', 'promptEmpty', 'timeoutInvalid', 'sessionMissing', 'runContextUnavailable', 'runContextInvalid']);

/** One journal serializes actual CLI calls across analysis, repair, scoring and briefs. */
export class NewsRunJournal {
	private tail: Promise<void> = Promise.resolve();
	constructor(private readonly read: () => readonly NewsRun[], private readonly save: (runs: NewsRun[]) => Promise<void>) {}
	spent(now = Date.now()): number {
		const day = newsLocalDay(now);
		return this.read().filter(run => (run.receipt?.day ?? newsLocalDay(run.at)) === day).reduce((sum, run) => sum + run.calls, 0);
	}
	async recover(): Promise<void> {
		if (!this.read().some(run => run.receipt?.state === 'started')) return;
		await this.save(this.read().map(run => run.receipt?.state === 'started' ? { ...run, status: 'interrupted', receipt: { ...run.receipt, state: 'interrupted', errorCode: 'outcomeUnknown' } } : run));
	}
	retireObsolete(materials: readonly NewsMaterial[]): Promise<void> {
		return this.serialized(async () => {
			const obsolete = new Set(this.read().filter(run => run.receipt?.kind === 'analysis' && run.receipt.state === 'received' && run.receipt.plan && !run.receipt.plan.materials.some(saved => materials.some(current => current.id === saved.id && current.revision === saved.revision && current.contentHash === saved.contentHash))).map(run => run.receipt!.batchId));
			if (!obsolete.size) return;
			await this.save(this.read().map(run => run.receipt?.state === 'received' && obsolete.has(run.receipt.batchId) ? { ...run, status: 'superseded', receipt: { ...run.receipt, state: 'applied', errorCode: 'materialChanged' } } : run));
		});
	}
	resume(retryIds: ReadonlySet<string> = new Set(), materials?: readonly NewsMaterial[], analyses: readonly NewsAnalysis[] = []): { resume: ResumableAnalysis[]; blockedIds: Set<string> } {
		const groups = new Map<string, NewsRun[]>();
		for (const run of this.read()) {
			if (run.receipt?.kind !== 'analysis' || !run.receipt.plan) continue;
			const group = groups.get(run.receipt.batchId) ?? [];
			group.push(run); groups.set(run.receipt.batchId, group);
		}
		const resume: ResumableAnalysis[] = [], blockedIds = new Set<string>();
		for (const runs of groups.values()) {
			const plan = runs[0]!.receipt!.plan!;
			const unknown = runs.some(run => run.receipt!.state === 'interrupted' || run.receipt!.state === 'started');
			const active = plan.materials.filter(item => (!materials || materials.some(current => current.id === item.id && current.revision === item.revision && current.contentHash === item.contentHash)) && (!unknown || retryIds.has(item.id) || !analyses.some(analysis => analysis.materialId === item.id && analysis.revision === item.revision && analysis.contentHash === item.contentHash)));
			if (!active.length) continue;
			if (runs.some(run => run.receipt!.state === 'applied')) continue;
			if (unknown && !active.every(material => retryIds.has(material.id))) {
				for (const material of active) blockedIds.add(material.id);
				continue;
			}
			const received = runs.filter(run => run.receipt!.state === 'received');
			if (!received.length && !unknown) continue;
			resume.push({ plan, answers: received.flatMap(run => run.receipt?.result ? [{ sample: run.receipt.sample, attempt: run.receipt.attempt, result: run.receipt.result }] : []) });
		}
		return { resume, blockedIds };
	}
	finish(batchId: string, state: 'applied' | 'failed', errorCode?: string): Promise<void> {
		return this.serialized(() => this.save(this.read().map(run => run.receipt?.batchId === batchId && run.receipt.state === 'received' ? { ...run, status: state === 'applied' ? 'complete' : 'failed', receipt: { ...run.receipt, state, errorCode } } : run)));
	}
	attention(batchId: string, errorCode: string): Promise<void> {
		return this.serialized(() => this.save(this.read().map(run => run.receipt?.batchId === batchId && run.receipt.state === 'received'
			? { ...run, status: 'needs-attention', receipt: { ...run.receipt, errorCode } } : run)));
	}
	private serialized<T>(work: () => Promise<T>): Promise<T> {
		const task = this.tail.then(work);
		this.tail = task.then(() => undefined, () => undefined);
		return task;
	}
	call(receipt: Omit<NewsRunReceipt, 'state' | 'day' | 'usageKnown'>, limit: number, invoke: () => Promise<AgentPromptResult>): Promise<{ runId: string; result: AgentPromptResult; calls: number }> {
		return this.serialized(async () => {
			if (this.spent() >= limit) return { runId: '', result: { status: 'failed' as const, text: '', errorCode: 'newsBudget' }, calls: 0 };
			const at = Date.now();
			const run: NewsRun = {
				id: `${receipt.kind}-${crypto.randomUUID()}`, at, status: 'started', calls: 1, spent: this.spent(at) + 1,
				...(receipt.brief ? { storyId: receipt.brief.storyId, materialId: receipt.brief.materialId } : {}),
				receipt: { ...receipt, state: 'started', day: newsLocalDay(at), usageKnown: false },
			};
			// Durable reservation before any CLI starts. An unknown outcome retains its quota.
			await this.save([...this.read(), run]);
			let result: AgentPromptResult;
			try { result = await invoke(); } catch { result = { status: 'interrupted', text: '', errorCode: 'runnerFailed' }; }
			const notSent = !result.terminalId && (result.errorCode === 'newsBatchTimeout' || result.status === 'cancelled' || result.status === 'failed' && PRE_SEND_ERRORS.has(result.errorCode ?? ''));
			const state = result.status === 'succeeded' ? 'received' : result.status === 'interrupted' ? 'interrupted' : 'failed';
			const next: NewsRun = { ...run, calls: notSent ? 0 : 1, status: state === 'received' ? state : result.status, receipt: { ...run.receipt!, state, result, agentId: result.agentId ?? receipt.agentId, accountIdentity: result.accountIdentity, usageKnown: result.usage?.known === true, endedAt: Date.now(), errorCode: result.errorCode } };
			// Raw native response must be durable before parsing or applying business records.
			await this.save(this.read().map(item => item.id === run.id ? next : item));
			return { runId: run.id, result, calls: next.calls };
		});
	}
	async flush(): Promise<void> { await this.tail; }
}
