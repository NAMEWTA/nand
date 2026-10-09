import type { DocumentValue } from './document-repository';

export interface CollectionDocument extends DocumentValue {
	id: string;
	path: string;
}
/** Domain-owned mapping; infrastructure never knows a habit, book or ledger entry. */
export interface DocumentCollectionCodec<T> {
	root: string;
	/** Keys owned by this domain, including keys absent after changing a variant. */
	managedProperties?: readonly string[];
	empty(): T;
	encode(value: T): CollectionDocument[];
	decode(documents: CollectionDocument[]): T;
}
export function documentName(name: string): string {
	return (
		Array.from(name, (char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '-' : char))
			.join('')
			.replace(/[. ]+$/g, '')
			.slice(0, 100) || '未命名'
	);
}
export function collectionDocument(
	id: string,
	path: string,
	type: string,
	properties: Record<string, unknown>,
	rows?: Array<Record<string, unknown>>,
): CollectionDocument {
	return { id, path, properties: { 'nand-type': type, 'nand-id': id, ...properties }, ...(rows ? { rows } : {}) };
}

/** A document's own properties, without the collection's `nand-type`/`nand-id` bookkeeping. */
export function documentProperties(document: CollectionDocument): Record<string, unknown> {
	const { 'nand-type': _type, 'nand-id': _id, ...properties } = document.properties;
	return properties;
}

/**
 * Record-table rows as the domain wrote them: empty cells (read back as null) are left out, and `storageKeys`
 * that only the table needs (such as a row id derived from the timestamp) are removed.
 */
export function recordRows<T>(document: CollectionDocument, storageKeys: readonly string[] = []): T[] {
	return (document.rows ?? []).map((row) => Object.fromEntries(Object.entries(row).filter(([key, value]) => value !== null && !storageKeys.includes(key))) as T);
}
