import { App, Component, MarkdownRenderer, Platform } from 'obsidian';
import { attachNoteHover } from '../ui/hover-preview';
import { getRenderContext, resolveNoteFile } from './render-context';

export function memoMarkdownSource(text: string): string {
	const lines = text.split('\n');
	const out: string[] = [];
	let listBuf: string[] = [];
	let inFence = false;
	const flush = (): void => {
		if (listBuf.length > 0) {
			out.push(...listBuf, '');
			listBuf = [];
		}
	};
	for (const line of lines) {
		if (/^\s*(```|~~~)/.test(line)) {
			flush();
			inFence = !inFence;
			out.push(line);
			continue;
		}
		if (inFence) {
			out.push(line);
			continue;
		}
		const isListItem = /^(\s*)([-*+]|\d+\.)\s+/.test(line);
		const isContinuation = listBuf.length > 0 && /^\s+\S/.test(line);
		if (isListItem || isContinuation) {
			listBuf.push(line);
		} else {
			flush();
			out.push(line, '');
		}
	}
	flush();
	return out
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
export function renderMemoMarkdown(
	container: HTMLElement,
	text: string,
	app: App,
	component: Component,
): Promise<void> {
	const host = container.ownerDocument.createElement('div');
	return MarkdownRenderer.render(app, memoMarkdownSource(text), host, '', component)
		.then(() => {
			if (!container.isConnected || !host.hasChildNodes()) return;
			container.empty();
			container.addClass('dashboard-memo-view--md');
			while (host.firstChild) container.appendChild(host.firstChild);
			wireMemoMarkdownLinks(container, app);
		})
		.catch(() => {
			// Keep the plain-lines paint — a render failure must not blank the card.
		});
}
export function wireMemoMarkdownLinks(container: HTMLElement, app: App): void {
	const context = getRenderContext(container);
	container.querySelectorAll('a').forEach((raw) => {
		const a = raw as HTMLElement;
		const href = a.getAttribute('href') ?? '';
		if (a.hasClass('internal-link') || href === '' || href.startsWith('#')) {
			const target = a.getAttribute('data-href') ?? a.getText();
			const path = target.split('#')[0]!;
			const file = resolveNoteFile(app, path);
			if (file && !Platform.isMobile && context.hoverParent) {
				attachNoteHover(
					app,
					a,
					file,
					context.hoverParent,
					target.includes('#') ? `#${target.split('#').pop()}` : undefined,
				);
			}
			a.addEventListener('click', (e) => {
				e.stopPropagation();
				e.preventDefault();
				if (!file) return;
				context.noteOpener?.(file, target.includes('#') ? `#${target.split('#').pop()}` : undefined);
			});
		} else if (/^https?:/i.test(href)) {
			a.addEventListener('click', (e) => {
				e.stopPropagation();
				e.preventDefault();
				container.ownerDocument.defaultView?.open(href, '_blank');
			});
		}
	});
}
