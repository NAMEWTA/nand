export const DATA_NAMESPACE_VERSION = 1;

/** Check raw data before defaults are merged or any automatic write occurs. */
export function requiresNamespaceMigration(data: unknown): boolean {
	if (data === null || data === undefined) return false;
	return (
		typeof data !== 'object' ||
		Array.isArray(data) ||
		(data as Record<string, unknown>).dataNamespaceVersion !== DATA_NAMESPACE_VERSION
	);
}
