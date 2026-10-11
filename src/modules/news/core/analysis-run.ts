import type { AgentPromptResult } from '../../agent/api';
import type { NewsAnalysis, NewsAnalysisRow, NewsMaterial, NewsSource } from './model';
import { buildAnalysisPrompt, effectivePromptVersion, materialBody, parseAnalysisJson, type AnalysisPromptOptions } from './prompts';
import { acceptScore, type NewsThresholds, type NewsWeights } from './scoring';
import { candidateIds, type CandidateIds, type NewsCandidates } from './recall';
import { DEFAULT_VOCABULARY, prefilterReason, type NewsPrefilter, type NewsVocabulary } from './analysis-policy';
import { DEFAULT_GROUPING_RULES, type GroupingRules } from './editorial-rules';

export interface AnalysisPlan {
	batchId: string;
	materials: NewsMaterial[];
	version: string;
	prompt: string;
	candidateIds: CandidateIds;
	sampleCount: number;
	vocabulary?: NewsVocabulary;
	groupingConfidence?: number;
}
export interface ResumableAnalysis {
	plan: AnalysisPlan;
	answers: { sample: number; attempt: number; result: AgentPromptResult }[];
}
export interface AnalysisCall {
	plan: AnalysisPlan;
	keepTerminal: boolean;
	continueTerminalId?: string;
	batchId: string;
	materials: readonly NewsMaterial[];
	version: string;
	sample: number;
	attempt: number;
}
export interface AnalysisRunner {
	run(prompt: string, call: AnalysisCall): Promise<AgentPromptResult>;
	close?(terminalId: string): Promise<void>;
}
export interface AnalysisRun {
	status: 'complete' | 'needs-attention' | 'budget' | 'failed' | 'cancelled' | 'interrupted' | 'timeout';
	analyses: NewsAnalysis[];
	spent: number;
	calls: number;
	errorCode?: string;
	unknownIds?: string[];
	missingIds?: string[];
}
export interface AnalysisOptions extends AnalysisPromptOptions {
	prefilter?: NewsPrefilter;
	candidatesFor?: (batch: readonly NewsMaterial[]) => NewsCandidates;
	batchSize?: number;
	maxPromptChars?: number;
	doubleScore?: boolean;
	sources?: readonly NewsSource[];
	weights?: NewsWeights;
	thresholds?: NewsThresholds;
	understandFloor?: number;
	groupingRules?: GroupingRules;
	forceIds?: ReadonlySet<string>;
	blockedIds?: ReadonlySet<string>;
	resume?: readonly ResumableAnalysis[];
	onBatch?: (analyses: readonly NewsAnalysis[], batchId: string) => Promise<void>;
	onFailure?: (batchId: string, code: string) => Promise<void>;
}

/** A changed prompt affects new material; completed revisions require explicit reanalysis. */
export function analysisNeedsRefresh(material: NewsMaterial, previous: NewsAnalysis | undefined): boolean {
	return !previous || previous.contentHash !== material.contentHash || previous.revision !== material.revision;
}

/** Bound count and the actual serialized prompt, including rules and escaped material text. */
export function analysisBatches(materials: readonly NewsMaterial[], options: AnalysisOptions): NewsMaterial[][] {
	const batches: NewsMaterial[][] = [];
	let batch: NewsMaterial[] = [];
	const size = options.batchSize ?? 12;
	const fits = (items: NewsMaterial[]): boolean => {
		const prompt = buildAnalysisPrompt(items, { ...options, candidates: options.candidatesFor?.(items) ?? options.candidates });
		return items.length <= size && prompt.length + (prompt.match(/[\\"]/g)?.length ?? 0) <= (options.maxPromptChars ?? 22_000) && new TextEncoder().encode(prompt).length <= 80_000;
	};
	for (const material of materials) {
		if (batch.length && !fits([...batch, material])) { batches.push(batch); batch = []; }
		if (!fits([material])) throw new Error('news.prompt.tooLarge');
		batch.push(material);
	}
	if (batch.length) batches.push(batch);
	return batches;
}

/** One active batch; a repair reuses its retained terminal, independent samples do not. */
export async function runMaterialAnalysis(materials: readonly NewsMaterial[], previous: readonly NewsAnalysis[], runner: AnalysisRunner, budget: number, spent = 0, now = Date.now(), options: AnalysisOptions = {}): Promise<AnalysisRun> {
	const resumedIds = new Set(options.resume?.flatMap(item => item.plan.materials.filter(saved => materials.some(current => current.id === saved.id && current.revision === saved.revision && current.contentHash === saved.contentHash)).map(material => material.id)));
	const pending = materials.filter(material => !resumedIds.has(material.id) && !options.blockedIds?.has(material.id) && !prefilterReason(material, options.prefilter) && (options.forceIds?.has(material.id) || analysisNeedsRefresh(material, previous.find(item => item.materialId === material.id))));
	const result: AnalysisRun = { status: 'complete', analyses: [...previous], spent, calls: 0, unknownIds: [], missingIds: [] };
	if (!pending.length && !options.resume?.length) return result;
	const plans: ResumableAnalysis[] = [...(options.resume ?? [])];
	let effectiveVersion: string | undefined;
	while (plans.length || pending.length) {
		if (!plans.length) {
			try {
				effectiveVersion ??= await effectivePromptVersion(options);
				const batch = analysisBatches(pending, options)[0]!;
				pending.splice(0, batch.length);
				const candidates = options.candidatesFor?.(batch) ?? options.candidates;
				plans.push({ plan: { batchId: crypto.randomUUID(), materials: batch.map(item => ({ ...item, body: materialBody(item, options.bodyLimit), summary: '', bodyExcerpt: '' })), version: effectiveVersion, prompt: buildAnalysisPrompt(batch, { ...options, candidates }), candidateIds: candidateIds(batch, candidates), sampleCount: options.doubleScore ? 2 : 1, vocabulary: structuredClone(options.vocabulary ?? DEFAULT_VOCABULARY), groupingConfidence: (options.groupingRules ?? DEFAULT_GROUPING_RULES).confidencePercent / 100 }, answers: [] });
			} catch (error) { return { ...result, status: 'failed', errorCode: error instanceof Error ? error.message : 'promptInvalid' }; }
		}
		const { plan, answers } = plans.shift()!;
		const { materials: batch, prompt, batchId, version } = plan;
		const fail = async (code: string, status: AnalysisRun['status'] = 'failed'): Promise<AnalysisRun> => {
			await options.onFailure?.(batchId, code);
			return { ...result, status, errorCode: code };
		};
		const samples: NewsAnalysisRow[][] = [];
		let identity: Pick<AgentPromptResult, 'agentId' | 'accountIdentity'> | undefined;
		for (let sample = 0; sample < plan.sampleCount; sample++) {
			let terminalId: string | undefined;
			try {
				for (let attempt = 0; attempt < 2; attempt++) {
					const cached = answers.find(item => item.sample === sample && item.attempt === attempt);
					let answer: AgentPromptResult;
					if (cached) answer = cached.result;
					else {
						if (result.spent >= budget) return { ...result, status: 'budget' };
						if (attempt > 0 && !terminalId) return await fail('repairSessionClosed');
						try {
							answer = await runner.run(attempt === 0 ? prompt : 'The response failed the required schema. Return only the complete corrected <nand-news-json>{"materials":[...]}</nand-news-json>, using the original material and candidate IDs.', {
								plan, keepTerminal: true, ...(terminalId ? { continueTerminalId: terminalId } : {}), batchId, materials: batch, version, sample, attempt,
							});
						} catch { return await fail('runnerFailed'); }
						if (answer.errorCode === 'newsBudget') return { ...result, status: 'budget' };
						result.spent++;
						result.calls++;
						terminalId = answer.terminalId;
					}
					if (answer.status !== 'succeeded') return await fail(answer.errorCode ?? answer.status, answer.status);
					if (identity && (identity.agentId !== answer.agentId || identity.accountIdentity !== answer.accountIdentity)) return await fail('accountChanged');
					identity = { agentId: answer.agentId, accountIdentity: answer.accountIdentity };
					const parsed = parseAnalysisJson(answer.text, batch, plan.candidateIds, plan.vocabulary);
					result.unknownIds!.push(...parsed.unknownIds);
					if (parsed.invalidEnvelope || parsed.invalidIds.length) {
						if (attempt === 1) return await fail('invalidAnalysis');
						continue;
					}
					samples.push(parsed.rows);
					result.missingIds!.push(...parsed.missingIds);
					break;
				}
			} finally { if (terminalId) await runner.close?.(terminalId); }
		}
		const fresh: NewsAnalysis[] = [];
		for (const material of batch) {
			const rows = samples.flatMap(sample => sample.filter(row => row.id === material.id));
			if (rows.length !== samples.length || !rows.length) { result.status = 'needs-attention'; continue; }
			fresh.push({ ...acceptScore(material, rows[0]!, {
				version, now, tier: options.sources?.find(source => source.id === material.sourceId)?.tier,
				samples: rows.map(item => ({ itemType: item.itemType, axes: item.axes, qualityFlags: item.qualityFlags })),
				weights: options.weights, thresholds: options.thresholds, understandFloor: options.understandFloor, groupingConfidence: plan.groupingConfidence ?? DEFAULT_GROUPING_RULES.confidencePercent / 100,
			}), ...identity });
		}
		await options.onBatch?.(fresh, batchId);
		result.analyses = [...result.analyses.filter(item => !fresh.some(next => next.materialId === item.materialId)), ...fresh];
	}
	return result;
}
