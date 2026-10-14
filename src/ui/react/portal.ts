const roots = new WeakMap<Document, { el: HTMLElement; refs: number }>();

export function getPortalRoot(doc: Document): HTMLElement | null {
	return roots.get(doc)?.el ?? null;
}

export function acquirePortalRoot(doc: Document): HTMLElement {
	let entry = roots.get(doc);
	if (!entry) {
		const el = doc.body.createDiv({ cls: 'nand-ui nand-portal-root' });
		entry = { el, refs: 0 };
		roots.set(doc, entry);
	}
	entry.refs++;
	return entry.el;
}
export function releasePortalRoot(doc: Document): void {
	const entry = roots.get(doc);
	if (!entry || --entry.refs > 0) return;
	entry.el.remove();
	roots.delete(doc);
}

// One toast renderer per document, transferred when its current surface closes.
const toastHosts = new WeakMap<Document, Set<(active: boolean) => void>>();
export function registerToastHost(doc: Document, update: (active: boolean) => void): () => void {
	const hosts = toastHosts.get(doc) ?? new Set<(active: boolean) => void>();
	toastHosts.set(doc, hosts);
	hosts.add(update);
	const notify = () => {
		let first = true;
		for (const host of hosts) {
			host(first);
			first = false;
		}
	};
	notify();
	return () => {
		hosts.delete(update);
		notify();
		if (!hosts.size) toastHosts.delete(doc);
	};
}
