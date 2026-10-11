import type { DocNode } from './types/model';

export function cardDocumentPaths(docs: readonly DocNode[]): string[] {
	return docs.flatMap(doc => [doc.path, ...cardDocumentPaths(doc.children ?? [])]);
}

/** Keep existing nesting/collapse state; removing a parent promotes its retained children. */
export function editCardDocuments(docs: readonly DocNode[], paths: readonly string[]): DocNode[] {
	const wanted = new Set(paths), existing = new Set(cardDocumentPaths(docs));
	const retain = (nodes: readonly DocNode[]): DocNode[] => nodes.flatMap(node => {
		const children = retain(node.children ?? []);
		if (!wanted.has(node.path)) return children;
		return [{ ...node, ...(node.children ? { children } : {}) }];
	});
	return [...retain(docs), ...[...wanted].filter(path => !existing.has(path)).map(path => ({ path }))];
}
