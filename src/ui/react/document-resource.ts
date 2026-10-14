/** Share modal bookkeeping across the two locked Radix dependency versions. */
const resources = new WeakMap<Document, Map<string, unknown>>();

export function documentResource<T>(doc: Document, key: string, create: () => T): T {
	let values = resources.get(doc);
	if (!values) {
		values = new Map();
		resources.set(doc, values);
	}
	if (!values.has(key)) values.set(key, create());
	return values.get(key) as T;
}
