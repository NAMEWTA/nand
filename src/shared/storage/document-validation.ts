import type { CollectionDocument } from './document-collection';

/** Reject malformed owned records before a tolerant UI normalizer can discard them. */
export function requireFields(
	value: Record<string, unknown>,
	strings: string[],
	numbers: string[],
	path: string,
): void {
	if (
		strings.some((key) => typeof value[key] !== 'string') ||
		numbers.some((key) => typeof value[key] !== 'number' || !Number.isFinite(value[key]))
	)
		throw new Error(`Invalid fields: ${path}`);
}
export function requireDailyRecords(document: CollectionDocument, strings: string[], numbers: string[]): void {
	const date = document.properties.date;
	if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !document.rows)
		throw new Error(`Invalid daily records: ${document.path}`);
	for (const row of document.rows) requireFields(row, ['id', ...strings], numbers, document.path);
}
