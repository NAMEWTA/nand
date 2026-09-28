/**
 * Compare two semver-ish strings. Returns positive when `a > b`, negative
 * when `a < b`, and zero when equal. Pre-release suffixes (`-rc.1` etc.)
 * sort lower than the matching release, but we do not implement full
 * semver pre-release ordering — just enough to surface "an upgrade is
 * available" in the UI.
 */
export function compareVersions(a: string, b: string): number {
	const parse = (version: string): { core: number[]; pre: string | null } => {
		const [corePart, pre = null] = version.split('-', 2);
		return {
			core: (corePart ?? '').split('.').map((part) => Number.parseInt(part, 10) || 0),
			pre,
		};
	};

	const left = parse(a);
	const right = parse(b);
	const length = Math.max(left.core.length, right.core.length);
	for (let i = 0; i < length; i += 1) {
		const li = left.core[i] ?? 0;
		const ri = right.core[i] ?? 0;
		if (li !== ri) return li - ri;
	}

	// Equal core: a release ranks higher than a pre-release.
	if (left.pre === right.pre) return 0;
	if (left.pre === null) return 1;
	if (right.pre === null) return -1;
	return left.pre < right.pre ? -1 : 1;
}
