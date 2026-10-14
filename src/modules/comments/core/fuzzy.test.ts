import { expect, test } from 'vitest';
import { approximateRanges } from './fuzzy';

/** Independent exhaustive substring oracle for small inputs. */
function distance(a: string, b: string): number {
	const table = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
	for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) table[i]![j] = Math.min(table[i - 1]![j]! + 1, table[i]![j - 1]! + 1, table[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
	return table[a.length]![b.length]!;
}
test('single-pass matches equal exhaustive minimum-distance ranges, including tied starts', () => {
	const words = ['a', 'b', 'aa', 'ab', 'ba', 'bb', 'aba', 'bbb', 'abba', 'babab', 'a😀b', '😀ab😀'];
	for (const pattern of words) for (const text of words) for (const max of [0, 1, 2]) {
		const priority = Float64Array.from({ length: text.length + 1 }, (_, i) => (i * 3) % 5);
		let minimum = max + 1;
		const expected: { from: number; to: number; distance: number }[] = [];
		for (let to = 1; to <= text.length; to++) {
			let best: { from: number; to: number; distance: number } | undefined;
			for (let from = 0; from < to; from++) {
				const d = distance(pattern, text.slice(from, to));
				if (!best || d < best.distance || (d === best.distance && priority[from]! > priority[best.from]!)) best = { from, to, distance: d };
			}
			if (best && best.distance <= max && best.distance <= minimum) {
				if (best.distance < minimum) { expected.length = 0; minimum = best.distance; }
				expected.push(best);
			}
		}
		expect(approximateRanges(pattern, text, max, priority), JSON.stringify({ pattern, text, max })).toEqual(expected);
	}
});
