import type { AgentPromptResult } from '../../agent/api';
import type { NewsAnalysis, NewsMaterial, NewsScoreAxes } from './model';
import { PROMPT_VERSION, buildAnalysisPrompt, parseAnalysisJson } from './prompts';
import { acceptScore } from './scoring';

export interface AnalysisRunner {
	run(prompt: string): Promise<AgentPromptResult>;
}

export interface AnalysisRun {
	status: 'complete' | 'needs-attention' | 'budget' | 'failed';
	analyses: NewsAnalysis[];
	spent: number;
	calls: number;
}

const AXES = ['relevance', 'novelty', 'quality', 'impact', 'clarity'] as const;

function axesOf(value: Record<string, number>): NewsScoreAxes | undefined {
	const axes = {} as NewsScoreAxes;
	for (const key of AXES) {
		const score = value[key];
		if (typeof score !== 'number' || !Number.isFinite(score)) return undefined;
		axes[key] = Math.max(0, Math.min(100, score));
	}
	return axes;
}

/** A finished revision is not sent again. */
export function analysisNeedsRefresh(material: NewsMaterial, previous: NewsAnalysis | undefined, version = PROMPT_VERSION): boolean {
	if (!previous) return true;
	return previous.version !== version || previous.raw !== material.contentHash;
}

/**
 * One prompt, one optional repair, then a terminal state.
 * A truncated tail is not an answer. The budget stops further calls.
 */
export async function runMaterialAnalysis(materials: readonly NewsMaterial[], previous: readonly NewsAnalysis[], runner: AnalysisRunner, budget: number, spent = 0, now = Date.now()): Promise<AnalysisRun> {
	const pending = materials.filter((material) => analysisNeedsRefresh(material, previous.find((item) => item.materialId === material.id)));
	if (!pending.length) return { status: 'complete', analyses: [...previous], spent, calls: 0 };
	if (spent >= budget) return { status: 'budget', analyses: [...previous], spent, calls: 0 };
	const ids = new Set(pending.map((material) => material.id));
	let calls = 0;
	let used = spent;
	const ask = async (prompt: string): Promise<AgentPromptResult | undefined> => {
		if (used >= budget) return undefined;
		used += 1;
		calls += 1;
		return runner.run(prompt);
	};
	const first = await ask(buildAnalysisPrompt(pending));
	if (!first) return { status: 'budget', analyses: [...previous], spent: used, calls };
	if (first.status === 'truncated') return { status: 'needs-attention', analyses: [...previous], spent: used, calls };
	if (first.status !== 'complete') return { status: 'failed', analyses: [...previous], spent: used, calls };
	let rows = parseAnalysisJson(first.text, ids);
	if (!rows.length) {
		const repair = await ask(`${buildAnalysisPrompt(pending)}\n\nThe previous reply was not valid JSON. Return the JSON array only.`);
		if (!repair) return { status: 'budget', analyses: [...previous], spent: used, calls };
		if (repair.status === 'truncated') return { status: 'needs-attention', analyses: [...previous], spent: used, calls };
		if (repair.status !== 'complete') return { status: 'failed', analyses: [...previous], spent: used, calls };
		rows = parseAnalysisJson(repair.text, ids);
		if (!rows.length) return { status: 'needs-attention', analyses: [...previous], spent: used, calls };
	}
	const fresh: NewsAnalysis[] = [];
	for (const row of rows) {
		const material = pending.find((item) => item.id === row.id);
		const axes = material ? axesOf(row.axes) : undefined;
		if (!material || !axes) continue;
		fresh.push({ ...acceptScore(material, axes), version: PROMPT_VERSION, raw: material.contentHash, createdAt: now, ...(row.reason ? { reason: row.reason } : {}) });
	}
	if (fresh.length !== pending.length) return { status: 'needs-attention', analyses: [...previous.filter((item) => !fresh.some((next) => next.materialId === item.materialId)), ...fresh], spent: used, calls };
	const rest = previous.filter((item) => !fresh.some((next) => next.materialId === item.materialId));
	return { status: 'complete', analyses: [...rest, ...fresh], spent: used, calls };
}
