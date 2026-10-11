import type { AnalysisRunner, AnalysisRun, AnalysisPlan } from '../core/analysis-run';
import type { NewsEvents, NewsMergeReview, NewsRun } from '../core/model';
import { buildMergeReviewPrompt, parseMergeReview } from '../core/merge-review';
import { effectivePromptVersion } from '../core/prompts';
import type { NewsSettings } from '../settings';
import type { NewsRunJournal } from './run-journal';

export interface GroupReviewPort {
	events(): NewsEvents;
	runs(): readonly NewsRun[];
	apply(review: NewsMergeReview): Promise<void>;
	stopped(): boolean;
}

/** Reapply received reviews without CLI calls; unknown sends wait for explicit retry. */
export async function recoverGroupReviews(port: GroupReviewPort, journal: NewsRunJournal): Promise<void> {
	const batches = new Set(port.runs().filter(run => run.receipt?.kind === 'grouping' && run.receipt.state === 'received').map(run => run.receipt!.batchId));
	for (const batchId of batches) {
		const rows = port.runs().filter(run => run.receipt?.batchId === batchId);
		const last = rows[rows.length - 1]!.receipt!;
		if (last.state !== 'received' || !last.merge) continue;
		const review = parseMergeReview(last.result?.text ?? '', last.merge.id);
		if (!review) { await journal.finish(batchId, 'failed', 'invalidMergeReview'); continue; }
		if (port.events().proposals.some(proposal => proposal.id === review.proposalId)) await port.apply(review);
		await journal.finish(batchId, 'applied');
	}
}

/** Merge reviews use the shared durable call ledger and a fresh owned terminal. */
export async function reviewGroups(port: GroupReviewPort, journal: NewsRunJournal, runner: AnalysisRunner, settings: Partial<NewsSettings>, budget: number, retryIds: ReadonlySet<string>): Promise<{ status: AnalysisRun['status']; calls: number }> {
	await recoverGroupReviews(port, journal);
	let calls = 0, status: AnalysisRun['status'] = 'complete';
	const seen = new Set<string>();
	for (const proposal of port.events().proposals) {
		if (seen.has(proposal.id) || port.events().reviews.some(review => review.proposalId === proposal.id && review.confidence >= 0.75)) continue;
		seen.add(proposal.id);
		const previous = port.runs().filter(run => run.receipt?.kind === 'grouping' && run.receipt.merge?.id === proposal.id);
		if (previous.length && !retryIds.has(proposal.bridgeId) && !retryIds.has(proposal.left.id) && !retryIds.has(proposal.right.id)) { status = 'needs-attention'; continue; }
		if (port.stopped()) return { status: 'cancelled', calls };
		const batchId = crypto.randomUUID();
		const plan: AnalysisPlan = { batchId, version: await effectivePromptVersion(settings), prompt: buildMergeReviewPrompt(proposal, settings.templates), materials: [proposal.left, proposal.right], candidateIds: {}, sampleCount: 1 };
		let terminalId: string | undefined;
		try {
			for (let attempt = 0; attempt < 2; attempt++) {
				if (attempt && !terminalId) { status = 'needs-attention'; break; }
				const prompt = attempt ? 'Return only a valid <nand-news-merge>{"kind":"SAME_OCCURRENCE|SAME_STORY|UNRELATED|ROUNDUP","confidence":0.0}</nand-news-merge> for the same two roots.' : plan.prompt;
				const receipt = await journal.call({ kind: 'grouping', batchId, merge: proposal, plan, sample: 0, attempt, agentId: settings.agentId }, budget, async () => {
					if (port.stopped()) return { status: 'cancelled', text: '' };
					const result = await runner.run(prompt, { plan, batchId, materials: plan.materials, version: plan.version, sample: 0, attempt, keepTerminal: true, ...(terminalId ? { continueTerminalId: terminalId } : {}) });
					terminalId = result.terminalId ?? terminalId;
					return result;
				});
				calls += receipt.calls;
				terminalId = receipt.result.terminalId ?? terminalId;
				if (receipt.result.errorCode === 'newsBudget') return { status: 'budget', calls };
				if (receipt.result.status !== 'succeeded') return { status: receipt.result.status, calls };
				const review = parseMergeReview(receipt.result.text, proposal.id);
				if (!review) {
					if (attempt === 1 || !terminalId) { await journal.finish(batchId, 'failed', 'invalidMergeReview'); status = 'needs-attention'; }
					continue;
				}
				await port.apply(review);
				await journal.finish(batchId, 'applied');
				if (review.confidence < 0.75 || !port.events().reviews.some(item => item.proposalId === proposal.id)) status = 'needs-attention';
				break;
			}
		} finally { if (terminalId) await runner.close?.(terminalId); }
	}
	return { status, calls };
}
