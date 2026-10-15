import { Component, MarkdownRenderer, type App } from 'obsidian';
import { useEffect, useRef, useState } from 'react';
import { contentFiles, type ContentFile } from '../../host/obsidian/storage/content-files';
import type { ContentDraft } from '../../host/obsidian/storage/content-draft';
import { renderContentLinks } from '../../host/obsidian/storage/content-links';
import { t } from '../../shared/i18n';
import { Input } from '../../ui/components/input';
import { Textarea } from '../../ui/components/textarea';
import { useT } from '../../ui/react/hooks';
import { Button } from '../../ui/components/button';
import { contentMigrationCandidates, resolveContentCandidate } from '../../host/obsidian/storage/content-migration';

const message = (error: unknown) =>
	t('content.saveFailed', { error: error instanceof Error ? error.message : String(error) });

export function ContentSearch({ app, folder, owner }: { app: App; folder: string; owner: Window }) {
	useT();
	const [query, setQuery] = useState(''),
		[revision, setRevision] = useState(0),
		[matches, setMatches] = useState<readonly ContentFile[]>([]),
		[error, setError] = useState('');
	const [candidates, setCandidates] = useState<string[]>([]),
		[busy, setBusy] = useState(false);
	useEffect(() => {
		let cancelled = false;
		void contentMigrationCandidates(app)
			.then((paths) => {
				if (!cancelled) setCandidates(paths);
			})
			.catch((reason) => {
				if (!cancelled) setError(message(reason));
			});
		return () => {
			cancelled = true;
		};
	}, [app, revision]);
	const resolve = (path: string, owned: boolean) => {
		setBusy(true);
		void resolveContentCandidate(app, path, owned)
			.then(() => setRevision((value) => value + 1))
			.catch((reason) => setError(message(reason)))
			.finally(() => setBusy(false));
	};
	useEffect(() => contentFiles(app).subscribe(() => setRevision((value) => value + 1)), [app]);
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const result: ContentFile[] = [],
				files = contentFiles(app),
				term = query.trim().toLocaleLowerCase();
			for (const file of files.allManaged()) {
				if (folder && !file.path.startsWith(folder + '/')) continue;
				if (
					!term ||
					file.path.toLocaleLowerCase().includes(term) ||
					(file.extension === 'md' && (await files.read(file)).toLocaleLowerCase().includes(term))
				)
					result.push(file);
				if (cancelled) return;
			}
			if (!cancelled) {
				setMatches(result);
				setError('');
			}
		})().catch((reason) => {
			if (!cancelled) setError(message(reason));
		});
		return () => {
			cancelled = true;
		};
	}, [app, folder, query, revision]);
	return (
		<>
			{!!candidates.length && (
				<details>
					<summary>{t('content.reviewNeeded', { count: candidates.length })}</summary>
					<p>{t('content.reviewHelp')}</p>
					{candidates.map((path) => (
						<div key={path} className="flex flex-wrap items-center gap-2">
							<span>{path}</span>
							<Button
								disabled={busy}
								onClick={() => {
									void contentFiles(app)
										.open(path, owner)
										.catch((reason) => setError(message(reason)));
								}}
							>
								{t('content.reviewOpen')}
							</Button>
							<Button disabled={busy} onClick={() => resolve(path, true)}>
								{t('content.reviewMove')}
							</Button>
							<Button disabled={busy} onClick={() => resolve(path, false)}>
								{t('content.reviewOrdinary')}
							</Button>
						</div>
					))}
				</details>
			)}
			<label className="flex flex-col gap-2 text-sm">
				{t('content.search')}
				<Input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
			</label>
			<p className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
				{error}
			</p>
			<div className="flex flex-col items-start gap-2">
				{matches.map((file) => (
					<Button
						key={file.path}
						onClick={() => {
							void contentFiles(app)
								.open(file.path, owner)
								.catch((reason) => setError(message(reason)));
						}}
					>
						{file.path.replace(/^\.nand\/content\//, '')}
					</Button>
				))}
				{!matches.length && <p>{t('content.noResults')}</p>}
			</div>
		</>
	);
}

export function ContentEditor({
	app,
	draft,
	owner,
	focus,
}: {
	app: App;
	draft: ContentDraft;
	owner: Window;
	focus?: string;
}) {
	useT();
	const [, render] = useState(0),
		[preview, setPreview] = useState(!!focus && !focus.startsWith('#line=')),
		[error, setError] = useState('');
	const timer = useRef<number | undefined>(undefined),
		body = useRef<HTMLDivElement>(null),
		input = useRef<HTMLTextAreaElement>(null);
	const observe = (work: Promise<void>) => {
		void work.catch((reason) => setError(message(reason)));
	};
	useEffect(() => {
		const stop = draft.subscribe(() => {
			render((value) => value + 1);
			setError('');
		});
		return () => {
			stop();
			owner.clearTimeout(timer.current);
		};
	}, [draft, owner]);
	useEffect(() => {
		if (preview || !input.current || !focus?.startsWith('#line=')) return;
		const line = Number(focus.slice(6));
		if (!Number.isInteger(line) || line < 0) return;
		const start = draft.value
			.split('\n')
			.slice(0, line)
			.reduce((length, text) => length + text.length + 1, 0);
		input.current.focus();
		input.current.setSelectionRange(
			start,
			Math.max(
				start,
				draft.value.indexOf('\n', start) < 0 ? draft.value.length : draft.value.indexOf('\n', start),
			),
		);
		input.current.scrollTop = line * (parseFloat(owner.getComputedStyle(input.current).lineHeight) || 20);
	}, [draft, focus, preview, owner]);
	useEffect(() => {
		if (!preview || !body.current) return;
		const host = body.current,
			component = new Component();
		let cancelled = false;
		component.load();
		host.empty();
		void MarkdownRenderer.render(app, draft.value, host, draft.path, component)
			.then(async () => {
				if (cancelled) return;
				await renderContentLinks(app, host, draft.path);
				if (cancelled || !focus) return;
				let text = focus.replace(/^#/, '');
				try {
					text = decodeURIComponent(text);
				} catch {
					/* A literal percent heading remains a valid target. */
				}
				const target = [...host.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,[data-block-id]')].find(
					(element) =>
						text.startsWith('^')
							? element.dataset.blockId === text.slice(1)
							: (element.dataset.heading ?? element.textContent)?.trim() === text,
				);
				target?.scrollIntoView({ block: 'start' });
			})
			.catch((reason) => {
				if (!cancelled) setError(message(reason));
			});
		return () => {
			cancelled = true;
			component.unload();
			host.empty();
		};
	}, [app, draft, draft.value, preview, focus]);
	return (
		<>
			<p className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
				{error || (draft.error ? message(draft.error) : t(draft.dirty ? 'content.unsaved' : 'content.saved'))}
			</p>
			<div className="flex flex-wrap items-center gap-2">
				<Button onClick={() => observe(draft.save())}>{t('content.save')}</Button>
				<Button onClick={() => setPreview((value) => !value)}>
					{t(preview ? 'content.edit' : 'content.preview')}
				</Button>
			</div>
			<div className="min-h-0 flex-1 overflow-auto">
				{preview ? (
					<div ref={body} className="nand-native markdown-rendered" />
				) : (
					<Textarea
						ref={input}
						className="h-full min-h-96 resize-none font-mono"
						aria-label={t('content.edit')}
						spellCheck={false}
						value={draft.value}
						onChange={(event) => {
							observe(draft.edit(event.currentTarget.value));
							owner.clearTimeout(timer.current);
							timer.current = owner.setTimeout(() => observe(draft.save()), 600);
						}}
						onKeyDown={(event) => {
							if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
								event.preventDefault();
								observe(draft.save());
							}
						}}
					/>
				)}
			</div>
		</>
	);
}

export function ContentAttachment({ file, url }: { file: ContentFile; url: string }) {
	useT();
	if (/^(png|jpg|jpeg|gif|webp|svg|avif)$/i.test(file.extension))
		return <img className="max-h-full max-w-full object-contain" src={url} alt={file.basename} />;
	if (/^(mp3|wav|ogg|m4a)$/i.test(file.extension)) return <audio src={url} controls />;
	if (/^(mp4|webm)$/i.test(file.extension))
		return <video className="max-h-full max-w-full object-contain" src={url} controls />;
	if (file.extension === 'pdf')
		return <iframe className="h-full min-h-96 w-full flex-1" src={url} title={file.basename} />;
	return <p>{t('content.attachment', { path: file.path })}</p>;
}
