import { Component, MarkdownRenderer, type App } from 'obsidian';
import { useEffect, useRef, useState } from 'preact/hooks';
import { contentFiles, type ContentFile } from '../../host/obsidian/storage/content-files';
import type { ContentDraft } from '../../host/obsidian/storage/content-draft';
import { renderContentLinks } from '../../host/obsidian/storage/content-links';
import { t } from '../../shared/i18n';
import { Button } from '../../ui/primitives/Button';

const message = (error: unknown) => t('content.saveFailed', { error: error instanceof Error ? error.message : String(error) });

export function ContentSearch({ app, folder, owner }: { app: App; folder: string; owner: Window }) {
	const [query, setQuery] = useState(''), [revision, setRevision] = useState(0), [matches, setMatches] = useState<readonly ContentFile[]>([]), [error, setError] = useState('');
	useEffect(() => contentFiles(app).subscribe(() => setRevision(value => value + 1)), [app]);
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const result: ContentFile[] = [], files = contentFiles(app), term = query.trim().toLocaleLowerCase();
			for (const file of files.allManaged()) {
				if (folder && !file.path.startsWith(folder + '/')) continue;
				if (!term || file.path.toLocaleLowerCase().includes(term) || file.extension === 'md' && (await files.read(file)).toLocaleLowerCase().includes(term)) result.push(file);
				if (cancelled) return;
			}
			if (!cancelled) { setMatches(result); setError(''); }
		})().catch(reason => { if (!cancelled) setError(message(reason)); });
		return () => { cancelled = true; };
	}, [app, folder, query, revision]);
	return <>
		<label class="nand-field">{t('content.search')}<input class="nand-input" type="search" value={query} onInput={event => setQuery(event.currentTarget.value)} /></label>
		<p class="nand-content-status" aria-live="polite">{error}</p>
		<div class="nand-content-results nand-ui-list">{matches.map(file => <Button key={file.path} onClick={() => { void contentFiles(app).open(file.path, owner).catch(reason => setError(message(reason))); }}>{file.path.replace(/^\.nand\/content\//, '')}</Button>)}{!matches.length && <p>{t('content.noResults')}</p>}</div>
	</>;
}

export function ContentEditor({ app, draft, owner, focus }: { app: App; draft: ContentDraft; owner: Window; focus?: string }) {
	const [, render] = useState(0), [preview, setPreview] = useState(!!focus), [error, setError] = useState('');
	const timer = useRef<number>(), body = useRef<HTMLDivElement>(null);
	const observe = (work: Promise<void>) => { void work.catch(reason => setError(message(reason))); };
	useEffect(() => {
		const stop = draft.subscribe(() => { render(value => value + 1); setError(''); });
		return () => { stop(); owner.clearTimeout(timer.current); };
	}, [draft, owner]);
	useEffect(() => {
		if (!preview || !body.current) return;
		const host = body.current, component = new Component(); let cancelled = false;
		component.load(); host.empty();
		void MarkdownRenderer.render(app, draft.value, host, draft.path, component).then(async () => {
			if (cancelled) return;
			await renderContentLinks(app, host, draft.path);
			if (cancelled || !focus) return;
			const text = decodeURIComponent(focus.replace(/^#/, ''));
			const target = [...host.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,[data-block-id]')].find(element => text.startsWith('^') ? element.dataset.blockId === text.slice(1) : (element.dataset.heading ?? element.textContent)?.trim() === text);
			target?.scrollIntoView({ block: 'start' });
		}).catch(reason => { if (!cancelled) setError(message(reason)); });
		return () => { cancelled = true; component.unload(); host.empty(); };
	}, [app, draft, draft.value, preview, focus]);
	return <>
		<p class="nand-content-status" aria-live="polite">{error || (draft.error ? message(draft.error) : t(draft.dirty ? 'content.unsaved' : 'content.saved'))}</p>
		<div class="nand-ui-toolbar"><Button onClick={() => observe(draft.save())}>{t('content.save')}</Button><Button onClick={() => setPreview(value => !value)}>{t(preview ? 'content.edit' : 'content.preview')}</Button></div>
		<div class="nand-content-body">{preview ? <div ref={body} /> : <textarea class="nand-content-editor nand-input" aria-label={t('content.edit')} spellcheck={false} value={draft.value}
			onInput={event => { observe(draft.edit(event.currentTarget.value)); owner.clearTimeout(timer.current); timer.current = owner.setTimeout(() => observe(draft.save()), 600); }}
			onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); observe(draft.save()); } }} />}</div>
	</>;
}

export function ContentAttachment({ file, url }: { file: ContentFile; url: string }) {
	if (/^(png|jpg|jpeg|gif|webp|svg|avif)$/i.test(file.extension)) return <img class="nand-content-attachment" src={url} alt={file.basename} />;
	if (/^(mp3|wav|ogg|m4a)$/i.test(file.extension)) return <audio src={url} controls />;
	if (/^(mp4|webm)$/i.test(file.extension)) return <video class="nand-content-attachment" src={url} controls />;
	if (file.extension === 'pdf') return <iframe class="nand-content-attachment" src={url} title={file.basename} />;
	return <p>{t('content.attachment', { path: file.path })}</p>;
}
