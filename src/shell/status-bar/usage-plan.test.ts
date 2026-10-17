import { expect, test } from 'vitest';
import type { UsageProvider } from '../../app/contracts/workbench';
import { planUsage, USAGE_LIMIT } from './usage-plan';

const provider = (id: string, used: number): UsageProvider => ({ id, name: id, windows: [{ label: '5h', usedPercent: used }] });

test('few providers are all shown in both modes', () => {
	const rows = [provider('claude', 10), provider('codex', 20)];
	expect(planUsage(rows, 'verbose')).toEqual({ shown: rows, hidden: [] });
	expect(planUsage(rows, 'compact').hidden).toEqual([]);
});

test('extra providers fold into the chip but the busiest ones stay visible, in provider order', () => {
	const rows = [provider('a', 5), provider('b', 96), provider('c', 40), provider('d', 85)];
	const plan = planUsage(rows, 'verbose');
	expect(plan.shown.map((p) => p.id)).toEqual(['b', 'd']);
	expect(plan.hidden.map((p) => p.id)).toEqual(['a', 'c']);
	expect(planUsage(rows, 'compact').hidden).toEqual([]);
	expect(USAGE_LIMIT.compact).toBeGreaterThan(USAGE_LIMIT.verbose);
});
