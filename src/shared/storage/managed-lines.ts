/** Align owned lines while leaving unmatched author prose and comments in place. */
function matches(a: string[], b: string[]): Array<[number, number]> {
	const key = (line: string) => line.trim();
	if (a.length * b.length > 1_000_000) {
		const positions = new Map<string, number[]>();
		b.forEach((line, index) => {
			const list = positions.get(key(line)) ?? [];
			list.push(index);
			positions.set(key(line), list);
		});
		let after = -1;
		return a.flatMap((line, index) => {
			const at = positions.get(key(line))?.find((position) => position > after);
			if (at === undefined) return [];
			after = at;
			return [[index, at] as [number, number]];
		});
	}
	const width = b.length + 1,
		lengths = new Uint32Array((a.length + 1) * width);
	for (let i = a.length - 1; i >= 0; i--)
		for (let j = b.length - 1; j >= 0; j--)
			lengths[i * width + j] =
				key(a[i]!) === key(b[j]!)
					? lengths[(i + 1) * width + j + 1]! + 1
					: Math.max(lengths[(i + 1) * width + j]!, lengths[i * width + j + 1]!);
	const result: Array<[number, number]> = [];
	for (let i = 0, j = 0; i < a.length && j < b.length;) {
		if (key(a[i]!) === key(b[j]!)) {
			result.push([i++, j++]);
		} else if (lengths[(i + 1) * width + j]! >= lengths[i * width + j + 1]!) i++;
		else j++;
	}
	return result;
}
export function patchManagedLines(original: string, baseline: string, next: string): string {
	if (baseline === next) return original;
	const newline = original.includes('\r\n') ? '\r\n' : '\n';
	const split = (text: string) => text.replace(/\r\n/g, '\n').split('\n');
	const raw = split(original),
		base = split(baseline),
		generated = split(next);
	const rawAt = new Map(matches(base, raw));
	const deletions = new Set<number>(),
		insertions = new Map<number, string[]>();
	let previousBase = -1,
		previousNext = -1;
	for (const [baseIndex, nextIndex] of [
		...matches(base, generated),
		[base.length, generated.length] as [number, number],
	]) {
		const changed = Array.from({ length: baseIndex - previousBase - 1 }, (_, offset) => previousBase + 1 + offset);
		const mapped = changed.flatMap((index) => (rawAt.has(index) ? [rawAt.get(index)!] : []));
		for (const index of mapped) deletions.add(index);
		const added = generated.slice(previousNext + 1, nextIndex);
		const insert = (position: number, lines: string[]) =>
			insertions.set(position, [...(insertions.get(position) ?? []), ...lines]);
		if (added.length === changed.length && mapped.length === changed.length)
			added.forEach((line, index) => insert(mapped[index]!, [line]));
		else if (added.length) insert(mapped[0] ?? rawAt.get(baseIndex) ?? raw.length, added);
		previousBase = baseIndex;
		previousNext = nextIndex;
	}
	return [
		...raw.flatMap((line, index) => [...(insertions.get(index) ?? []), ...(deletions.has(index) ? [] : [line])]),
		...(insertions.get(raw.length) ?? []),
	].join(newline);
}
