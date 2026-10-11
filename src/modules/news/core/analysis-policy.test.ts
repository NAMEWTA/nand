import { expect, test } from 'vitest';
import { analysisAnswer, analysisRow } from '../../../../test/news/analysis';
import { DEFAULT_PREFILTER, DEFAULT_VOCABULARY, normalizePrefilter, normalizeVocabulary, prefilterReason } from './analysis-policy';
import { runMaterialAnalysis, type AnalysisPlan } from './analysis-run';
import { upsertMaterial } from './materials';
import { buildAnalysisPrompt, effectivePromptVersion, parseAnalysisJson } from './prompts';
import { DEFAULT_GROUPING_RULES } from './editorial-rules';

const material = await upsertMaterial(undefined, { sourceId: 'feed', url: 'https://example.com/item', title: 'A useful release', body: 'Available now', language: 'EN-us' });

test('received analysis retains the batch relation threshold when settings change before recovery', async () => {
	let plan: AnalysisPlan | undefined;
	const answer = analysisAnswer();
	const first = await runMaterialAnalysis([material], [], { run: async (_prompt, call) => { plan = structuredClone(call.plan); return { status: 'succeeded', text: answer }; } }, 1, 0, Date.now(), { groupingRules: { ...DEFAULT_GROUPING_RULES, confidencePercent: 65 } });
	expect(plan!.groupingConfidence).toBe(0.65); expect(first.analyses[0]!.groupingConfidence).toBe(0.65);
	const recovered = await runMaterialAnalysis([material], [], { run: async () => { throw Error('recovery must not call'); } }, 0, 0, Date.now(), { groupingRules: { ...DEFAULT_GROUPING_RULES, confidencePercent: 95 }, resume: [{ plan: plan!, answers: [{ sample: 0, attempt: 0, result: { status: 'succeeded', text: answer } }] }] });
	expect(recovered.analyses[0]!.groupingConfidence).toBe(0.65); expect(recovered.calls).toBe(0);
});

test('local filters match normalized literal terms and declared language, and skip calls without discarding raw input', async () => {
	expect(material.language).toBe('en-us');
	expect(prefilterReason(material, { ...DEFAULT_PREFILTER, blockedTerms: ['ＵＳＥＦＵＬ'] })).toBe('blocked-term');
	expect(prefilterReason(material, { ...DEFAULT_PREFILTER, minCharacters: 100 })).toBe('short');
	expect(prefilterReason(material, { ...DEFAULT_PREFILTER, languages: ['zh'] })).toBe('language');
	expect(prefilterReason(material, { ...DEFAULT_PREFILTER, languages: ['en'] })).toBeUndefined();
	expect(prefilterReason({ ...material, language: undefined }, { ...DEFAULT_PREFILTER, languages: ['zh'] })).toBeUndefined();
	let calls = 0;
	const runner = { run: async () => { calls++; return { status: 'succeeded' as const, text: analysisAnswer() }; } };
	const input = structuredClone(material);
	expect(await runMaterialAnalysis([material], [], runner, 0, 0, Date.now(), { prefilter: { ...DEFAULT_PREFILTER, blockedTerms: ['release'] }, forceIds: new Set([material.id]) })).toMatchObject({ status: 'complete', calls: 0, spent: 0, analyses: [] });
	expect(calls).toBe(0);
	expect(material).toEqual(input);
	expect(await runMaterialAnalysis([material], [], runner, 1)).toMatchObject({ status: 'complete', calls: 1 });
});

test('vocabulary drives prompts, validation and version; a saved reply recovers with its batch vocabulary', async () => {
	const vocabulary = { categories: ['Release'], topics: ['Tools'], entities: [] };
	const row = analysisRow('m0', { category: 'Release', tags: ['Release', 'Tools'] });
	const answer = analysisAnswer([row]);
	expect(buildAnalysisPrompt([material], { vocabulary })).toContain(JSON.stringify(vocabulary));
	expect(buildAnalysisPrompt([material], { vocabulary: { ...vocabulary, topics: ['{{interest}}'] }, interest: 'Preference' })).toContain('"topics":["{{interest}}"]');
	expect(parseAnalysisJson(answer, [material]).rows).toHaveLength(0);
	expect(parseAnalysisJson(answer, [material], {}, vocabulary).rows).toHaveLength(1);
	expect(parseAnalysisJson(analysisAnswer([{ ...row, tags: ['Release', 'Unknown'] }]), [material], {}, vocabulary).rows).toHaveLength(0);
	expect(await effectivePromptVersion({ vocabulary })).not.toBe(await effectivePromptVersion());
	let plan: AnalysisPlan | undefined;
	const result = await runMaterialAnalysis([material], [], { run: async (_prompt, call) => { plan = structuredClone(call.plan); return { status: 'succeeded', text: answer }; } }, 1, 0, Date.now(), { vocabulary });
	expect(result.analyses[0]?.category).toBe('Release');
	expect(plan?.vocabulary).toEqual(vocabulary);
	const resumed = await runMaterialAnalysis([material], [], { run: async () => { throw Error('must not call'); } }, 0, 0, Date.now(), {
		vocabulary: DEFAULT_VOCABULARY, prefilter: { ...DEFAULT_PREFILTER, blockedTerms: ['release'] },
		resume: [{ plan: plan!, answers: [{ sample: 0, attempt: 0, result: { status: 'succeeded', text: answer } }] }],
	});
	expect(resumed).toMatchObject({ status: 'complete', calls: 0, spent: 0 });
	expect(resumed.analyses[0]?.category).toBe('Release');
	expect((await runMaterialAnalysis([material], result.analyses, { run: async () => { throw Error('must not call'); } }, 1, 0, Date.now(), { vocabulary: DEFAULT_VOCABULARY })).calls).toBe(0);
});

test('persisted policy normalizes duplicates and bounds while preserving intentional empty tag lists', () => {
	expect(normalizeVocabulary({ categories: [' Test ', 'Test'], topics: [], entities: [] })).toEqual({ categories: ['Test'], topics: [], entities: [] });
	expect(normalizeVocabulary({ categories: [] }).categories).toEqual(DEFAULT_VOCABULARY.categories);
	expect(normalizePrefilter({ blockedTerms: [' x ', 'x'], languages: ['EN-us', 'en-US', 'bad language'], minCharacters: -1 })).toEqual({ blockedTerms: ['x'], languages: ['en-us'], minCharacters: 0 });
});
