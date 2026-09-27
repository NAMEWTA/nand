import type { EditorView, ViewUpdate } from '@codemirror/view';
import { editorInfoField } from 'obsidian';
import type DashboardPlugin from '../../plugin/main';
import { makeAnchor, selectionIsCommentable } from './anchor';
import { getCommentStore } from './store';
import { mountCommentComposer, type CommentComposer } from './composer';
import { intersectRects, placePopover } from './popover-position';
import type { CommentPopoverCoordinator } from './popover-coordinator';

interface SelectionContext { path: string; from: number; to: number; exact: string }

/** One editor's transient draft. Workspace ownership belongs to the coordinator. */
export class SelectionPopover {
	private popover: HTMLElement | null = null;
	private composer: CommentComposer | null = null;
	private context: SelectionContext | null = null;
	private dead = false;
	private enabled = false;
	private placed = false;
	private cleanup: (() => void) | null = null;
	private document: Document | null = null;
	private observer: ResizeObserver | null = null;
	private cancelSave: (() => void) | null = null;

	constructor(private readonly view: EditorView, private readonly plugin: DashboardPlugin,
		private readonly coordinator: CommentPopoverCoordinator) {}

	get dom(): HTMLElement { return this.view.dom; }

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		if (!enabled) { this.clear(); this.unbind(); }
		else { this.bind(); this.queue(); }
	}

	refresh(): void {
		this.suspend();
		if (this.document !== this.dom.ownerDocument) {
			this.clear();
			this.unbind();
		}
		if (this.enabled) this.bind();
		this.queue();
	}

	update(update: ViewUpdate): void {
		if (this.enabled && this.view.hasFocus && (update.focusChanged || update.selectionSet)) this.coordinator.claim(this.dom);
		if (this.context && update.docChanged) {
			this.context.from = update.changes.mapPos(this.context.from, 1);
			this.context.to = update.changes.mapPos(this.context.to, -1);
		}
		if (this.context && !this.matchesContext()) this.clear();
		if (update.docChanged || update.selectionSet || update.geometryChanged || update.viewportChanged || update.focusChanged) this.queue();
	}

	destroy(): void {
		this.dead = true;
		this.clear();
		this.unbind();
	}

	private bind(): void {
		if (this.cleanup) return;
		const doc = this.document = this.dom.ownerDocument;
		const win = doc.defaultView;
		const refresh = () => this.refresh();
		const blur = () => this.suspend();
		const scroll = (event: Event) => {
			if (event.target && this.popover?.contains(event.target as Node)) return;
			refresh();
		};
		doc.addEventListener('scroll', scroll, true);
		win?.addEventListener('resize', refresh);
		win?.addEventListener('blur', blur);
		win?.addEventListener('focus', refresh);
		win?.visualViewport?.addEventListener('resize', refresh);
		win?.visualViewport?.addEventListener('scroll', refresh);
		// Construct in the editor's realm, including popout windows.
		const Observer = (win as (Window & { ResizeObserver?: typeof ResizeObserver }) | null)?.ResizeObserver;
		if (Observer) {
			this.observer = new Observer((entries) => {
				if (entries.some((entry) => entry.target !== this.popover || !this.popover.hidden)) this.queue();
			});
			this.observer.observe(this.view.scrollDOM);
			if (this.popover) this.observer.observe(this.popover);
		}
		this.cleanup = () => {
			doc.removeEventListener('scroll', scroll, true);
			win?.removeEventListener('resize', refresh);
			win?.removeEventListener('blur', blur);
			win?.removeEventListener('focus', refresh);
			win?.visualViewport?.removeEventListener('resize', refresh);
			win?.visualViewport?.removeEventListener('scroll', refresh);
			this.observer?.disconnect();
			this.observer = null;
		};
	}

	private unbind(): void { this.cleanup?.(); this.cleanup = null; this.document = null; }

	private suspend(): void {
		this.placed = false;
		this.composer?.setVisible(false);
		if (this.popover) this.popover.hidden = true;
		this.cancelSave?.();
		this.cancelSave = null;
	}

	private clear(): void {
		this.suspend();
		this.composer?.dispose();
		this.composer = null;
		if (this.popover) this.observer?.unobserve(this.popover);
		this.popover?.remove();
		this.popover = null;
		this.context = null;
	}

	private currentContext(): SelectionContext | null {
		const { state } = this.view;
		const path = state.field(editorInfoField, false)?.file?.path;
		const { from, to, empty } = state.selection.main;
		if (!path?.endsWith('.md') || empty || !selectionIsCommentable(state.doc.toString(), from, to)) return null;
		return { path, from, to, exact: state.doc.sliceString(from, to) };
	}

	private matchesContext(): boolean {
		const current = this.currentContext(), previous = this.context;
		return !!current && !!previous && current.path === previous.path && current.from === previous.from && current.to === previous.to && current.exact === previous.exact;
	}

	private eligible(): boolean {
		return !this.dead && this.enabled && this.plugin.settings.modules.editor &&
			this.plugin.settings.editorWorkbench.popoverEnabled && !!getCommentStore() &&
			this.dom.isConnected && this.coordinator.owns(this);
	}

	/** Called only from a CM measurement read phase. */
	private measure() {
		if (!this.eligible()) return null;
		const context = this.currentContext();
		const doc = this.dom.ownerDocument, win = doc.defaultView;
		if (!context || !win) return null;
		const viewport = win.visualViewport;
		const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
		const bounds = intersectRects(this.view.scrollDOM.getBoundingClientRect(), this.dom.getBoundingClientRect(), {
			left, top, right: left + (viewport?.width ?? win.innerWidth), bottom: top + (viewport?.height ?? win.innerHeight),
		});
		if (!bounds) return null;
		// visibleRanges includes a render margin: intersect actual selection rectangles
		// with the pane as well, so a rendered but scrolled-out line cannot own a popup.
		for (const range of this.view.visibleRanges) {
			const from = Math.max(context.from, range.from), to = Math.min(context.to, range.to);
			if (to <= from) continue;
			const start = this.view.domAtPos(from), end = this.view.domAtPos(to);
			const selection = doc.createRange();
			selection.setStart(start.node, start.offset);
			selection.setEnd(end.node, end.offset);
			for (const rect of Array.from(selection.getClientRects())) {
				const anchor = intersectRects(rect, bounds);
				if (anchor) return { anchor, bounds, context };
			}
		}
		return null;
	}

	private queue(): void {
		if (!this.eligible() || !this.currentContext()) { this.suspend(); return; }
		this.view.requestMeasure({
			key: this,
			read: () => {
				const source = this.measure();
				if (!source) return null;
				const rect = this.popover?.getBoundingClientRect();
				return { ...source, width: rect?.width ?? 0, height: rect?.height ?? 0,
					overflow: !!this.popover && this.popover.scrollHeight > this.popover.clientHeight + 1 };
			},
			write: (place) => {
				if (this.dead) return;
				if (!place || !this.eligible()) { this.suspend(); return; }
				const created = !this.popover;
				const pop = this.ensurePopover();
				const width = `${Math.max(0, place.bounds.right - place.bounds.left - 16)}px`;
				const height = `${Math.max(0, place.bounds.bottom - place.bounds.top - 16)}px`;
				const resized = pop.style.getPropertyValue('--nand-comment-width') !== width || pop.style.getPropertyValue('--nand-comment-height') !== height;
				if (created || resized || pop.hidden) {
					this.placed = false;
					this.composer?.setVisible(false);
					pop.style.setProperty('--nand-comment-width', width);
					pop.style.setProperty('--nand-comment-height', height);
					pop.addClass('is-measuring');
					pop.hidden = false;
					this.queue();
					return;
				}
				const position = placePopover(place.anchor, place.bounds, place.width, place.height);
				if (!position || place.overflow) { this.suspend(); return; }
				this.coordinator.claim(this.dom);
				pop.style.left = `${position.left}px`;
				pop.style.top = `${position.top}px`;
				pop.removeClass('is-measuring');
				this.placed = true;
				this.composer?.setVisible(true);
			},
		});
	}

	private ensurePopover(): HTMLElement {
		if (this.popover) return this.popover;
		const pop = this.popover = this.dom.ownerDocument.body.createDiv({ cls: 'nand-editor-comment-popover' });
		pop.addClass('is-measuring');
		this.composer = mountCommentComposer(pop, this.plugin.app,
			async (text) => {
				if (!this.eligible() || !this.placed || !this.matchesContext()) throw Error('Invalid comment source');
				const context = await new Promise<SelectionContext>((resolve, reject) => {
					this.cancelSave = () => reject(Error('Comment source hidden'));
					this.view.requestMeasure({
						read: () => this.measure(),
						write: (source) => {
							this.cancelSave = null;
							if (!source || !this.eligible() || !this.matchesContext()) reject(Error('Invalid comment source'));
							else resolve(source.context);
						},
					});
				});
				const store = getCommentStore();
				if (!store || !this.eligible() || !this.matchesContext()) throw Error('Invalid comment source');
				await store.add(context.path, { quote: makeAnchor(this.view.state.doc.toString(), context.from, context.to), start: context.from, end: context.to, text });
			},
			() => { if (this.eligible() && this.placed) this.view.focus(); },
			() => {
				if (!this.eligible() || !this.placed) return false;
				this.context = this.currentContext();
				return !!this.context;
			},
			() => this.queue(),
		);
		this.observer?.observe(pop);
		return pop;
	}
}
