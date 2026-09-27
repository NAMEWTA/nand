import type { App, EventRef, WorkspaceLeaf } from 'obsidian';

export interface CommentPopoverClient {
	readonly dom: HTMLElement;
	setEnabled(enabled: boolean): void;
	refresh(): void;
}

/** Workspace changes must invalidate body-level overlays even when CM is idle. */
export class CommentPopoverCoordinator {
	private readonly clients = new Set<CommentPopoverClient>();
	private events: EventRef[] = [];
	private enabled = false;
	private activeByDocument = new WeakMap<Document, WorkspaceLeaf>();
	private ownerByDocument = new WeakMap<Document, HTMLElement>();

	constructor(private readonly app: App) {}

	register(client: CommentPopoverClient): () => void {
		this.clients.add(client);
		client.setEnabled(this.enabled);
		return () => {
			this.clients.delete(client);
			if (this.ownerByDocument.get(client.dom.ownerDocument) === client.dom) this.ownerByDocument.delete(client.dom.ownerDocument);
		};
	}

	enable(): void {
		if (this.enabled) return;
		this.enabled = true;
		const workspace = this.app.workspace;
		const refresh = () => this.refresh();
		this.events = [
			workspace.on('active-leaf-change', (leaf) => {
				if (leaf) {
					this.activeByDocument.set(leaf.view.containerEl.ownerDocument, leaf);
					this.ownerByDocument.delete(leaf.view.containerEl.ownerDocument);
				}
				else {
					this.activeByDocument = new WeakMap();
					this.ownerByDocument = new WeakMap();
				}
				refresh();
			}),
			workspace.on('layout-change', refresh),
			workspace.on('window-open', refresh),
			workspace.on('window-close', refresh),
		];
		for (const client of this.clients) client.setEnabled(true);
	}

	disable(): void {
		this.enabled = false;
		for (const event of this.events) this.app.workspace.offref(event);
		this.events = [];
		this.activeByDocument = new WeakMap();
		this.ownerByDocument = new WeakMap();
		for (const client of this.clients) client.setEnabled(false);
	}

	refresh(): void {
		for (const client of this.clients) client.refresh();
	}

	claim(dom: HTMLElement): void {
		if (this.ownerByDocument.get(dom.ownerDocument) === dom) return;
		this.ownerByDocument.set(dom.ownerDocument, dom);
		for (const client of this.clients) {
			if (client.dom !== dom && client.dom.ownerDocument === dom.ownerDocument) client.refresh();
		}
	}

	// Workspace activation events are global; retain a separate owner per window.
	owns(client: CommentPopoverClient): boolean {
		if (!this.enabled) return false;
		let source: WorkspaceLeaf | null = null;
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.containerEl.contains(client.dom)) source = leaf;
		});
		if (!source) return false;
		const leaf: WorkspaceLeaf = source;
		const active = this.activeByDocument.get(client.dom.ownerDocument)
			?? this.app.workspace.getMostRecentLeaf(leaf.getContainer());
		const owner = this.ownerByDocument.get(client.dom.ownerDocument);
		return active === leaf && (!owner || owner.ownerDocument !== client.dom.ownerDocument || owner === client.dom);
	}
}
