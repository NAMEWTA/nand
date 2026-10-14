// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/editor/hover-gutter.ts, src/ui/thread-popover.ts
import type { EditorView } from '@codemirror/view';
import type { CommentsEnv } from '../env';
import { setHoveredLine } from './markers';
import { openThreads } from './selection';

/** Delegated hover, owned by one editor and its Document. */
export class HoverTracker {
	private hoverTimer: number | null = null;
	private lineTimer: number | null = null;
	private current: number | null = null;
	private pending: number | null = null;
	private readonly win: Window;
	constructor(private readonly view: EditorView, private readonly env: CommentsEnv) {
		this.win = view.dom.ownerDocument.defaultView!;
		view.scrollDOM.addEventListener('mousemove', this.onMove);
		view.scrollDOM.addEventListener('mouseleave', this.onLeave);
		view.dom.addEventListener('mouseover', this.onOver);
		view.dom.addEventListener('mouseout', this.onOut);
		view.dom.addEventListener('click', this.onClick);
	}
	private target(event: MouseEvent) {
		const node = event.target;
		return node && 'nodeType' in node && (node as Node).nodeType === 1 ? (node as Element).closest<HTMLElement>('.nand-comment-hl, .nand-comment-marker') : null;
	}
	private readonly onOver = (event: MouseEvent) => {
		const target = this.target(event); if (!target?.dataset['commentIds']) return;
		if (event.relatedTarget && target.contains(event.relatedTarget as Node)) return;
		this.clearHover(); this.env.overlay(this.view.dom.ownerDocument).cancelClose();
		this.hoverTimer = this.win.setTimeout(() => { this.hoverTimer = null; this.open(target, false); }, this.env.service.settings().hoverDelay);
	};
	private readonly onOut = (event: MouseEvent) => {
		const target = this.target(event); if (!target || (event.relatedTarget && target.contains(event.relatedTarget as Node))) return;
		this.clearHover();
		const related = event.relatedTarget as Element | null;
		if (related?.closest?.('[data-comments-overlay]')) this.env.overlay(this.view.dom.ownerDocument).cancelClose();
		else this.env.overlay(this.view.dom.ownerDocument).scheduleClose();
	};
	private readonly onClick = (event: MouseEvent) => { const target = this.target(event); if (!target?.classList.contains('nand-comment-hl')) return; this.clearHover(); this.open(target, true); };
	private open(target: HTMLElement, pinned: boolean) {
		if (!this.env.alive() || !target.isConnected) return;
		const ids = target.dataset['commentIds']?.split(' ').filter(Boolean) ?? [];
		openThreads(this.view, this.env, ids, this.view.state.selection.main.head, pinned);
	}
	private readonly onMove = (event: MouseEvent) => {
		const gutters = this.view.dom.querySelector('.cm-gutters');
		const rect = (gutters ?? this.view.scrollDOM).getBoundingClientRect();
		const offset = event.clientX - rect.left;
		if (offset < 0 || offset >= (gutters ? rect.width : 0) + 20) { this.schedule(null); return; }
		const pos = this.view.posAtCoords({ x: Math.max(event.clientX, this.view.contentDOM.getBoundingClientRect().left + 1), y: event.clientY });
		this.schedule(pos === null ? null : this.view.state.doc.lineAt(pos).number);
	};
	private readonly onLeave = () => this.schedule(null);
	private schedule(line: number | null) {
		if (line === this.pending || (this.lineTimer === null && line === this.current)) return;
		this.pending = line;
		if (this.lineTimer !== null) this.win.clearTimeout(this.lineTimer);
		this.lineTimer = this.win.setTimeout(() => { this.lineTimer = null; this.current = line; this.view.dispatch({ effects: setHoveredLine.of(line) }); }, 50);
	}
	private clearHover() { if (this.hoverTimer !== null) this.win.clearTimeout(this.hoverTimer); this.hoverTimer = null; }
	destroy() {
		this.clearHover(); if (this.lineTimer !== null) this.win.clearTimeout(this.lineTimer);
		this.view.scrollDOM.removeEventListener('mousemove', this.onMove); this.view.scrollDOM.removeEventListener('mouseleave', this.onLeave);
		this.view.dom.removeEventListener('mouseover', this.onOver); this.view.dom.removeEventListener('mouseout', this.onOut); this.view.dom.removeEventListener('click', this.onClick);
	}
}
