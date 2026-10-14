// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/editor/hover-gutter.ts, src/editor/gutter-state.ts
import { gutter, GutterMarker, type EditorView } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { Platform, setIcon } from 'obsidian';
import { t } from '../../../../shared/i18n';
import type { CommentsEnv } from '../env';
import { hoveredLineField, refreshComments, setHoveredLine, threadsOnLine } from './markers';
import { openForLine } from './selection';

export function countBadgeText(count: number): string | null { return count < 2 ? null : count > 9 ? '9+' : String(count); }
class CommentMarker extends GutterMarker {
	constructor(readonly ids: string[], readonly showCount: boolean, readonly kind: 'add' | 'open' | 'resolved') { super(); }
	eq(other: CommentMarker) { return this.ids.join(' ') === other.ids.join(' ') && this.showCount === other.showCount && this.kind === other.kind; }
	toDOM(view: EditorView) {
		const span = view.dom.ownerDocument.createElement('span');
		span.className = `nand-comment-marker is-${this.kind}`;
		span.dataset['commentIds'] = this.ids.join(' ');
		span.title = this.ids.length ? t('editor.comments.lineCount', { count: this.ids.length }) : t('editor.comments.addLine');
		const icon = span.createSpan({ cls: 'nand-comment-marker-icon' });
		setIcon(icon, this.kind === 'add' ? 'message-square-plus' : 'message-square');
		const badge = this.showCount ? countBadgeText(this.ids.length) : null;
		if (badge) icon.createSpan({ cls: 'nand-comment-marker-count', text: badge });
		return span;
	}
}
export function commentGutter(env: CommentsEnv) {
	return [hoveredLineField, Prec.high(gutter({
		class: 'nand-comment-gutter',
		lineMarker(view, block) {
			if (!env.alive() || !env.service.settings().gutterEnabled) return null;
			const first = view.state.doc.lineAt(block.from).number, last = view.state.doc.lineAt(block.to).number;
			const threads = threadsOnLine(view, env, first, last);
			const hover = Platform.isMobile || view.dom.ownerDocument.defaultView?.matchMedia('(pointer: coarse)').matches ? view.state.doc.lineAt(view.state.selection.main.head).number : view.state.field(hoveredLineField);
			if (!threads.length && (hover === null || hover < first || hover > last)) return null;
			return new CommentMarker(threads.map(thread => thread.id), env.service.settings().showCount, threads.length ? threads.some(thread => thread.status === 'open') ? 'open' : 'resolved' : 'add');
		},
		lineMarkerChange(update) { return update.selectionSet || update.transactions.some(tr => tr.effects.some(effect => effect.is(refreshComments) || effect.is(setHoveredLine))); },
		domEventHandlers: {
			mousedown(_view, _line, event) { event.preventDefault(); return true; },
			click(view, line, event) { event.preventDefault(); openForLine(view, env, view.state.doc.lineAt(line.from).number, view.state.doc.lineAt(line.to).number); return true; },
		},
	}))];
}
