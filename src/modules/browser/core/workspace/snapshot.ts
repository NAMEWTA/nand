/** Compare document values independently of YAML/Markdown property insertion order. Arrays stay ordered. */
export function snapshotJson(value: unknown): string | undefined {
	return JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
		? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
		: item);
}
