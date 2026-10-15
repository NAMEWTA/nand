// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/ui/render-comment-body.ts, src/ui/thread-card.ts
import { Component, MarkdownRenderer, type App } from 'obsidian';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';

export function CommentBody({ app, path, text, onEdit }: { app: App; path: string; text: string; onEdit?: () => void }) {
	const target = useRef<HTMLDivElement>(null);
	const [expanded, setExpanded] = useState(false);
	const [long, setLong] = useState(false);
	const t = useT();
	useEffect(() => {
		const el = target.current;
		if (!el) return;
		const owner = new Component(); owner.load();
		let alive = true;
		el.empty();
		void MarkdownRenderer.render(app, text, el, path, owner).then(() => { if (alive) setLong(el.scrollHeight > 150); }, () => { if (alive) el.setText(text); });
		const onLink = (event: MouseEvent) => {
			const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a.internal-link');
			const href = link?.getAttribute('data-href') ?? link?.getAttribute('href');
			if (!href) return;
			event.preventDefault(); event.stopPropagation(); void app.workspace.openLinkText(href, path, event.ctrlKey || event.metaKey);
		};
		el.addEventListener('click', onLink);
		return () => { alive = false; el.removeEventListener('click', onLink); owner.unload(); el.empty(); };
	}, [app, path, text]);
	return <><div ref={target} className={`nand-native markdown-rendered text-[13px] ${expanded ? '' : 'max-h-[150px] overflow-hidden'}`} onDoubleClick={onEdit} />{long && <Button variant="link" size="xs" onClick={() => setExpanded(!expanded)}>{t(expanded ? 'editor.comments.lessText' : 'editor.comments.moreText')}</Button>}</>;
}
