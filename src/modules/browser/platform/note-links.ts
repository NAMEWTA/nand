import type { Workspace } from 'obsidian';

/** Each Obsidian window has its own event propagation tree. */
export function observeNoteLinks(
	workspace: Workspace,
	enabled: () => boolean,
	route: (url: string, event: MouseEvent) => void,
): () => void {
	const documents = new Set<Document>();
	const click = (event: MouseEvent) => {
		if (!enabled()) return;
		const node = event.target as HTMLElement | null;
		const link = node?.closest?.<HTMLAnchorElement>('.markdown-rendered a.external-link');
		if (!link || !/^https?:/.test(link.href)) return;
		event.preventDefault();
		event.stopPropagation();
		route(link.href, event);
	};
	const add = (doc: Document) => {
		if (documents.has(doc)) return;
		documents.add(doc);
		doc.addEventListener('click', click, true);
	};
	const remove = (doc: Document) => {
		doc.removeEventListener('click', click, true);
		documents.delete(doc);
	};
	const opened = workspace.on('window-open', (_window, win) => add(win.document));
	const closed = workspace.on('window-close', (_window, win) => remove(win.document));
	add(workspace.containerEl.ownerDocument);
	workspace.iterateAllLeaves((leaf) => add(leaf.view.containerEl.ownerDocument));
	return () => {
		workspace.offref(opened);
		workspace.offref(closed);
		for (const doc of documents) remove(doc);
	};
}
