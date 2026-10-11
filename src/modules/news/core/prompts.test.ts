import { expect, test } from 'vitest';
import { briefDocument, briefPlan } from './prompts';

const url = 'https://example.com/article_(release)?a=1&b=2';
const document = `## 背景\n发布背景 [来源](<${url}>)\n## 影响\n对用户的影响\n## 时间线\n2026 年发布`;

test('briefs require real populated headings and exact linked destinations', () => {
	expect(briefDocument(document, [url])).toBe(true);
	expect(briefDocument(document.replace(`<${url}>`, url), [url])).toBe(true);
	expect(briefDocument(`提到了背景、影响和时间线 [来源](<${url}>)`, [url])).toBe(false);
	expect(briefDocument(document.replace('对用户的影响', ''), [url])).toBe(false);
	expect(briefDocument(document.replace(`<${url}>`, `<${url}evil>`), [url])).toBe(false);
	expect(briefDocument(document.replace(`[来源](<${url}>)`, url), [url])).toBe(false);
	expect(briefDocument('```markdown\n' + document + '\n```', [url])).toBe(false);
	expect(briefDocument(document, [url, 'https://example.com/missing'])).toBe(false);
});

test('brief prompt bounds source count and body size and validates only its actual source set', () => {
	const sources = Array.from({ length: 40 }, (_, i) => ({ id: String(i), title: 'title', url: `https://example.com/${i}`, summary: '摘'.repeat(10000), source: 'source' }));
	const plan = briefPlan('事件', [sources[0]!, ...sources])!;
	expect(plan.urls.length).toBeGreaterThan(0); expect(plan.urls.length).toBeLessThanOrEqual(12);
	expect(new Set(plan.urls).size).toBe(plan.urls.length);
	expect(plan.prompt.length).toBeLessThanOrEqual(22000);
	expect(new TextEncoder().encode(plan.prompt).length).toBeLessThanOrEqual(80000);
	const payload = JSON.parse(plan.prompt.slice(plan.prompt.lastIndexOf('\n\n') + 2));
	expect(payload.sources.map((item: { url: string }) => item.url)).toEqual(plan.urls);
	expect(payload.sources.every((item: { summary: string }) => item.summary.length === 1500)).toBe(true);
	expect(briefPlan('事件', sources, 'x'.repeat(22000))).toBeUndefined();
});
