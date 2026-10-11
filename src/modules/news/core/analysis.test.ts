import { expect, test } from 'vitest';
import { analysisAnswer, analysisRow } from '../../../../test/news/analysis';
import { parseAnalysisJson } from './analysis';
import { upsertMaterial } from './materials';
import { buildAnalysisPrompt, effectivePromptVersion } from './prompts';
import { DEFAULT_TEMPLATES } from './prompt-templates';

const material = await upsertMaterial(undefined, { sourceId: 'secret-source-name', url: 'https://example.com/a', title: 'Launch', body: 'Company released a model on 2026-10-09. Free for students.' });

test('opaque IDs, body excerpts and dates are sent without source metadata or prior scores', () => {
	const prompt = buildAnalysisPrompt([{ ...material, body: '', summary: '', bodyExcerpt: 'Excerpt fact', id: 'secret-source-name:123' }]);
	const payload = JSON.parse(prompt.slice(prompt.lastIndexOf('\n\n') + 2));
	expect(payload.materials).toEqual([{ id: 'm0', title: 'Launch', body: 'Excerpt fact', publishedAt: null, candidates: [] }]);
	expect(prompt).not.toContain('secret-source-name');
	expect(prompt).not.toContain('https://example.com');
});

test('one marked envelope validates IDs, duplicate rows, integer axes and candidate targets', () => {
	const valid = analysisRow();
	const parse = (rows: unknown[]) => parseAnalysisJson(`<nand-news-json>${JSON.stringify({ materials: rows })}</nand-news-json>`, [material]);
	expect(parse([valid, { id: 'foreign' }])).toMatchObject({ rows: [{ id: material.id }], unknownIds: ['foreign'], missingIds: [] });
	expect(parse([valid, valid])).toMatchObject({ rows: [], invalidIds: [material.id] });
	for (const sig of [-1, 11, 2.5, '8', null]) expect(parse([{ ...valid, axes: { ...valid.axes, sig } }]).rows).toEqual([]);
	expect(parse([{ ...valid, relations: [{ kind: 'SAME_OCCURRENCE', targetId: 'invented', confidence: 1 }] }]).rows).toEqual([]);
	expect(parse([{ ...valid, category: 'invented' }]).rows).toEqual([]);
	expect(parse([{ ...valid, tags: ['产品更新', 'made-up'] }]).rows).toEqual([]);
	expect(parseAnalysisJson(`Prose ${analysisAnswer()}`, [material]).invalidEnvelope).toBe(true);
	expect(parseAnalysisJson(analysisAnswer(), [material, { ...material, id: 'next' }]).missingIds).toEqual(['next']);
});

test('fact evidence must be continuous source text; composite and unknown material cannot invent frames', () => {
	const frame = { title: '发布模型', subject: 'Company', action: 'released', object: 'a model', occurredAt: '2026-10-09', evidence: 'Company released a model on 2026-10-09.', conditions: ['Free for students.'] };
	const row = analysisRow('m0', { scope: 'single', subject: 'Company', frame });
	const parse = (value = row) => parseAnalysisJson(analysisAnswer([value]), [material]);
	expect(parse().rows).toHaveLength(1);
	expect(parse({ ...row, frame: { ...frame, evidence: 'Company ... a model' } }).rows).toEqual([]);
	expect(parse({ ...row, frame: { ...frame, occurredAt: '2026-02-30' } }).rows).toEqual([]);
	expect(parse({ ...row, scope: 'composite' }).rows).toEqual([]);
	expect(parse({ ...row, qualityFlags: ['insufficient_event'] }).rows).toEqual([]);
});

test('every supplied candidate needs one verdict and aliases are scoped to the current material', () => {
	const aliases = { [material.id]: { c0: 'stored-report-a', c1: 'stored-report-b' } };
	const row = analysisRow('m0', { relations: [{ kind: 'SAME_OCCURRENCE', targetId: 'c0', confidence: 0.8 }, { kind: 'UNRELATED', targetId: 'c1', confidence: 1 }] });
	const parse = (value = row) => parseAnalysisJson(analysisAnswer([value]), [material], aliases);
	expect(parse().rows[0]?.relations.map(item => item.targetId)).toEqual(['stored-report-a', 'stored-report-b']);
	expect(parse({ ...row, relations: row.relations.slice(0, 1) }).rows).toEqual([]);
	expect(parse({ ...row, relations: [row.relations[0]!, row.relations[0]!] }).rows).toEqual([]);
	expect(parse({ ...row, relations: [{ ...row.relations[0]!, targetId: 'outside' }, row.relations[1]!] }).rows).toEqual([]);
});

test('effective hashes include interest, vocabulary dependencies and edited templates, while missing includes fail', async () => {
	const initial = await effectivePromptVersion();
	expect(initial).toMatch(/^[0-9a-f]{64}$/);
	expect(await effectivePromptVersion({ interest: 'coding' })).not.toBe(initial);
	expect(await effectivePromptVersion({ templates: { ...DEFAULT_TEMPLATES, writing: DEFAULT_TEMPLATES.writing + '\nExtra rule' } })).not.toBe(initial);
	await expect(effectivePromptVersion({ templates: { ...DEFAULT_TEMPLATES, writing: '{{unknown}}' } })).rejects.toThrow('news.prompt.variable');
	await expect(effectivePromptVersion({ templates: { ...DEFAULT_TEMPLATES, writing: '{{include:writing}}' } })).rejects.toThrow('news.prompt.include');
});
