import { expect, test } from 'vitest';
import { maxUsed, rankProviders, resetIn, resetUnits, shownPercent, usageMode, usageStatusKey, usageTone } from './usage-view';

const provider = (id: string, ...used: number[]) => ({
	id,
	name: id,
	windows: used.map((usedPercent, index) => ({ label: `w${index}`, usedPercent })),
});

test('the busiest window decides a provider rank, equal providers keep their order', () => {
	expect(maxUsed(provider('a', 10, 70))).toBe(70);
	expect(maxUsed(provider('none'))).toBe(0);
	expect(rankProviders([provider('a', 10), provider('b', 90), provider('c', 10), provider('d')]).map((p) => p.id)).toEqual([
		'b',
		'a',
		'c',
		'd',
	]);
});

test('percentages are clamped and can show what is left', () => {
	expect(shownPercent(42.4, 'used')).toBe(42);
	expect(shownPercent(42.4, 'remaining')).toBe(58);
	expect(shownPercent(140, 'used')).toBe(100);
	expect(shownPercent(-5, 'used')).toBe(0);
	expect([50, 80, 95].map(usageTone)).toEqual(['normal', 'warning', 'danger']);
});

test('the layout follows the measured box', () => {
	expect(usageMode({ width: 300, height: 90 })).toBe('top');
	expect(usageMode({ width: 150, height: 300 })).toBe('list');
	expect(usageMode({ width: 300, height: 150 })).toBe('list');
	expect(usageMode({ width: 300, height: 260 })).toBe('detail');
});

test('the reset countdown reads from the earliest reset and never goes negative', () => {
	const now = 1_000_000;
	expect(resetIn([], now)).toBeUndefined();
	expect(resetIn([now + 3 * 86_400_000 + 5 * 3_600_000, now + 90 * 60_000], now)).toEqual({ days: 0, hours: 1, minutes: 30 });
	expect(resetUnits({ days: 2, hours: 3, minutes: 9 })).toEqual({ key: 'usage.reset.days', values: { days: '2', hours: '3' } });
	expect(resetUnits({ days: 0, hours: 4, minutes: 5 })).toEqual({ key: 'usage.reset.hours', values: { hours: '4', minutes: '05' } });
	expect(resetIn([now - 5000], now)).toEqual({ days: 0, hours: 0, minutes: 0 });
});

test('a status code is shown through a dictionary key, never raw', () => {
	expect(usageStatusKey('idle')).toBe('usage.status.idle');
	expect(usageStatusKey('error')).toBe('usage.status.error');
	expect(usageStatusKey('something-new')).toBe('usage.failed');
	expect(usageStatusKey(undefined)).toBe('usage.failed');
});
