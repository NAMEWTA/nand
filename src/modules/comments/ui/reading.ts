// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/reading/reading-mode.ts, src/reading/reading-marks.ts
import { MarkdownRenderChild, MarkdownView, setIcon, type MarkdownPostProcessor } from 'obsidian';
import { decodeHTMLStrict } from 'entities';
import { mapSourceRange } from '../core/reading';
import { locateAnchor, lineNumberAt } from '../core/anchor';
import { t } from '../../../shared/i18n';
import type { CommentsEnv } from './env';

export function commentsReadingProcessor(env: CommentsEnv, cleanups: Set<() => void>): MarkdownPostProcessor {
	return async (el, ctx) => {
		if (!env.alive() || !env.service.settings().highlightEnabled || !ctx.sourcePath.endsWith('.md')) return;
		const info = ctx.getSectionInfo(el); if (!info || el.closest('.nand-comments-panel, .nand-comments-overlay-root, [data-comments-overlay]')) return;
		await env.service.load(ctx.sourcePath);
		if (!env.alive()) return;
		const threads = env.service.store.threadsFor(ctx.sourcePath).filter(thread => thread.status !== 'orphaned' && (thread.status !== 'resolved' || env.service.settings().highlightResolved));
		let blockStart = 0; for (let line = 0; line < info.lineStart; line++) blockStart = info.text.indexOf('\n', blockStart) + 1;
		let blockEnd = blockStart; for (let line = info.lineStart; line <= info.lineEnd; line++) { const next = info.text.indexOf('\n', blockEnd); blockEnd = next < 0 ? info.text.length : next + 1; }
		for (const thread of threads) {
			const found = locateAnchor(info.text, thread.anchor, env.service.settings().fuzzyThreshold);
			if (!found) continue;
			const line = lineNumberAt(info.text, found.start) - 1;
			if (line < info.lineStart || line > info.lineEnd) continue;
			const nodes = textNodesIn(el);
			const slices = thread.kind === 'range' ? mapSourceRange(nodes.map(node => node.data), info.text.slice(blockStart, blockEnd), found.start - blockStart, found.end - blockStart, decodeHTMLStrict) : null;
			if (slices) for (const slice of slices) {
				const node = nodes[slice.index]!;
				const target = slice.start > 0 ? node.splitText(slice.start) : node;
				if (slice.end - slice.start < target.data.length) target.splitText(slice.end - slice.start);
				const mark = el.ownerDocument.createElement('mark'); mark.className = 'nand-comment-hl'; mark.dataset['commentIds'] = thread.id; target.replaceWith(mark); mark.appendChild(target);
			} else {
				const marker = el.createEl('button', { cls: 'nand-comment-reading-marker', attr: { 'aria-label': t('editor.comments.lineCount', { count: 1 }) } });
				marker.dataset['commentIds'] = thread.id; setIcon(marker, 'message-square'); el.prepend(marker);
			}
		}
		const click = (event: MouseEvent) => {
			const target = event.target as Element | null;
			if (!target?.closest || target.closest('input, textarea')) return;
			const mark = target.closest<HTMLElement>('[data-comment-ids]'); if (!mark) return;
			const ids = new Set<string>(); for (let node: HTMLElement | null = mark; node && el.contains(node); node = node.parentElement) for (const id of node.dataset['commentIds']?.split(' ') ?? []) ids.add(id);
			event.preventDefault(); event.stopPropagation();
			env.open({ path: ctx.sourcePath, ownerDocument: el.ownerDocument, rect: () => mark.getBoundingClientRect(), mode: 'threads', threadIds: [...ids], pinned: true, focus: () => mark.focus() });
		};
		el.addEventListener('click', click);
		const cleanup = () => {
			el.removeEventListener('click', click);
			el.querySelectorAll('.nand-comment-reading-marker').forEach(marker => marker.remove());
			el.querySelectorAll('.nand-comment-hl').forEach(mark => mark.replaceWith(...Array.from(mark.childNodes)));
			cleanups.delete(cleanup);
		};
		cleanups.add(cleanup);
		const child = new MarkdownRenderChild(el); child.register(cleanup); ctx.addChild(child);
	};
}
function textNodesIn(root: HTMLElement): Text[] {
	const nodes: Text[] = [], walker = root.ownerDocument.createTreeWalker(root, 4);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) if (!(node.parentElement?.closest('pre, code, script, style, button'))) nodes.push(node as Text);
	return nodes;
}
export function refreshReadingViews(env: CommentsEnv, path?: string): void {
	for (const leaf of env.app.workspace.getLeavesOfType('markdown')) if (leaf.view instanceof MarkdownView && (!path || leaf.view.file?.path === path)) leaf.view.previewMode.rerender(true);
}
