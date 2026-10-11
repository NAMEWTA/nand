import type { NewsMergeProposal, NewsMergeReview } from './model';
import { DEFAULT_TEMPLATES, renderTemplate, type NewsPromptTemplates } from './prompt-templates';
import { materialBody } from './prompts';

/** A fresh comparison of the two roots, without the bridge's proposed verdict or score. */
export function buildMergeReviewPrompt(proposal: NewsMergeProposal, templates: NewsPromptTemplates = DEFAULT_TEMPLATES): string {
	return [renderTemplate('{{include:safety}}\n{{include:relations}}', templates, ''),
		'独立复核 A、B 两次根发生的关系；不得用一个共同提到它们的报道证明身份。只输出 <nand-news-merge>{"kind":"SAME_OCCURRENCE|SAME_STORY|UNRELATED|ROUNDUP","confidence":0到1}</nand-news-merge>。',
		JSON.stringify({ roots: [proposal.left, proposal.right].map((item, index) => ({ id: index ? 'B' : 'A', title: item.title, body: materialBody(item), publishedAt: item.publishedAt ?? null })) }),
	].join('\n\n');
}

export function parseMergeReview(text: string, proposalId: string): NewsMergeReview | undefined {
	const match = /^\s*<nand-news-merge>\s*([\s\S]*?)\s*<\/nand-news-merge>\s*$/.exec(text);
	let value: unknown;
	try { value = match ? JSON.parse(match[1]!) : undefined; } catch { return undefined; }
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	const row = value as Record<string, unknown>;
	if (Object.keys(row).some(key => key !== 'kind' && key !== 'confidence') || !['SAME_OCCURRENCE', 'SAME_STORY', 'UNRELATED', 'ROUNDUP'].includes(String(row.kind)) || typeof row.confidence !== 'number' || !Number.isFinite(row.confidence) || row.confidence < 0 || row.confidence > 1) return undefined;
	return { proposalId, kind: row.kind as NewsMergeReview['kind'], confidence: row.confidence };
}
