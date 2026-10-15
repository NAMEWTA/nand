// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/fuzzy.ts
/*!
MIT License

Copyright (c) 2026 jonaas-dev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/**
 * Levenshtein distance, abandoned once it is known to exceed `max`.
 *
 * The caller never needs the true distance of a bad candidate — only whether a
 * candidate is within tolerance — so the table is filled as a diagonal band of
 * width 2·max+1 and dropped as soon as every cell in a row is past the bound.
 * That turns the classic O(n·m) into O(n·max), which is what keeps re-anchoring
 * a long paragraph off the editor's back.
 *
 * Returns `max + 1` to mean "further than max", never the real distance.
 *
 * typescript:S3776 still reads this at 19 against a limit of 15, with the guards
 * already lifted out. The rest of the count is the band fill itself, and this is
 * the loop the timing budgets in #252 exist to watch: splitting it would put a
 * call in the innermost statement of the hottest path to satisfy a measure of
 * how the code reads. It reads as one algorithm because it is one.
 */
/**
 * The distance when it can be had without filling a table, or null.
 *
 * Two strings whose lengths differ by more than `max` cannot be within it
 * whatever they contain, and an empty string's distance is the other's length.
 * Kept out of the loop below so that function reads as the band fill it is.
 */
function withoutMeasuring(a: string, b: string, max: number): number | null {
	const beyond = max + 1;
	if (Math.abs(a.length - b.length) > max) return beyond;
	if (a.length === 0) return b.length <= max ? b.length : beyond;
	if (b.length === 0) return a.length <= max ? a.length : beyond;
	return null;
}

export function boundedLevenshtein(a: string, b: string, max: number): number {
	const beyond = max + 1;
	const trivial = withoutMeasuring(a, b, max);
	if (trivial !== null) return trivial;
	return boundedPrefixDistances(a, b, max)?.[b.length] ?? beyond;
}

/** One banded table scores every possible end, including insertions/deletions. */
export function boundedPrefixDistances(a: string, b: string, max: number): number[] | null {
	const beyond = max + 1;
	let previous = new Array<number>(b.length + 1).fill(beyond);
	for (let j = 0; j <= Math.min(b.length, max); j++) previous[j] = j;

	for (let i = 1; i <= a.length; i++) {
		const current = new Array<number>(b.length + 1).fill(beyond);
		current[0] = i <= max ? i : beyond;

		const from = Math.max(1, i - max);
		const to = Math.min(b.length, i + max);
		let bestInRow = current[0];

		for (let j = from; j <= to; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
			current[j] = value > max ? beyond : value;
			if (current[j]! < bestInRow) bestInRow = current[j]!;
		}

		// Every cell in the band is already past the bound, and distance never
		// decreases as rows are added.
		if (bestInRow > max) return null;
		previous = current;
	}

	return previous;
}

export interface ApproximateRange { from: number; to: number; distance: number }

/**
 * Sellers semi-global matching: skipping a text prefix is free, consuming the
 * whole pattern is required. One pass scores every end in O(pattern × text).
 * Two columns also carry the winning start (a cached traceback), so we need no
 * quadratic trace matrix. For equal distances, startPriority selects the best
 * context/line hint; that preference is independent of the eventual end.
 */
export function approximateRanges(pattern: string, text: string, max: number, startPriority: Float64Array): ApproximateRange[] {
	const size = pattern.length, beyond = max + 1;
	if (!size || !text.length) return [];
	const codes = Uint16Array.from({ length: size }, (_, i) => pattern.charCodeAt(i));
	let previous = new Uint32Array(size + 1), current = new Uint32Array(size + 1);
	let previousStarts = new Uint32Array(size + 1), currentStarts = new Uint32Array(size + 1);
	for (let i = 0; i <= size; i++) previous[i] = Math.min(i, beyond);
	const preferred = (a: number, b: number) => startPriority[a]! > startPriority[b]! || (startPriority[a] === startPriority[b] && a < b);
	let best = beyond;
	const matches: ApproximateRange[] = [];
	for (let end = 1; end <= text.length; end++) {
		current[0] = 0;
		currentStarts[0] = end;
		const code = text.charCodeAt(end - 1);
		for (let i = 1; i <= size; i++) {
			let distance = previous[i - 1]! + (codes[i - 1] === code ? 0 : 1);
			let start = previousStarts[i - 1]!;
			const deletion = current[i - 1]! + 1, deletedStart = currentStarts[i - 1]!;
			// Empty matches are not comment ranges. Prefix states may be empty to
			// allow leading pattern deletions, but the final state must consume text.
			if ((i < size || deletedStart < end) && (deletion < distance || (deletion === distance && preferred(deletedStart, start)))) { distance = deletion; start = deletedStart; }
			const insertion = previous[i]! + 1, insertedStart = previousStarts[i]!;
			if (insertion < distance || (insertion === distance && preferred(insertedStart, start))) { distance = insertion; start = insertedStart; }
			current[i] = Math.min(distance, beyond);
			currentStarts[i] = start;
		}
		const distance = current[size]!;
		if (distance <= max && distance <= best) {
			if (distance < best) { best = distance; matches.length = 0; }
			matches.push({ from: currentStarts[size]!, to: end, distance });
		}
		[previous, current] = [current, previous];
		[previousStarts, currentStarts] = [currentStarts, previousStarts];
	}
	return matches;
}
