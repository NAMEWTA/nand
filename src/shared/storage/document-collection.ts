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
