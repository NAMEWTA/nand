// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/media-section.ts
import { p1Classes } from '../theme/p1-classes';
import { Notice, Platform, type App } from 'obsidian';
import { type ContentFile } from '../../../../host/obsidian/storage/content-files';
import { useLayoutEffect, useRef, useState } from 'react';
import { t } from '../../../../shared/i18n';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
import { resolveVaultImage } from '../banner/image-resource';
import {
	formatDate,
	formatFileSize,
	getMediaBacklinks,
	type MediaFileResult,
	type MediaKind,
	type ThumbSize,
} from './media-presentation';
import { renameMediaFile } from './media-utils';

/** Decoder ownership follows the video node, including source replacement. */
export function MediaVideo({ src, className, play = false }: { src: string; className: string; play?: boolean }) {
	const ref = useRef<HTMLVideoElement>(null);
	useLayoutEffect(() => {
		const video = ref.current;
		if (!video) return;
		if (video.getAttribute('src') !== src) video.setAttribute('src', src);
		return () => {
			try {
				video.pause();
			} catch {
				/* detached decoder */
			}
			video.removeAttribute('src');
			try {
				video.load();
			} catch {
				/* detached decoder */
			}
		};
	}, [src]);
	return (
		<video
			ref={ref}
			src={src}
			className={p1Classes(className)}
			preload="metadata"
			muted={!play}
			playsInline
			controls={play}
			autoPlay={play}
		/>
	);
}
function Thumb({ app, result, kind, large }: { app: App; result: MediaFileResult; kind: MediaKind; large: boolean }) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);
	const src = resolveVaultImage(app, result.path);
	useLayoutEffect(() => {
		const root = ref.current;
		if (!root || kind !== 'video' || Platform.isMobile) return;
		const Observer = root.ownerDocument.defaultView?.IntersectionObserver;
		if (!Observer) return;
		const observer = new Observer(
			(entries) => {
				for (const entry of entries) setVisible(entry.isIntersecting);
			},
			{ rootMargin: '300px' },
		);
		observer.observe(root);
		return () => observer.disconnect();
	}, [kind, src]);
	if (!src) return <div className={p1Classes('dashboard-media-thumb dashboard-media-thumb--broken')} />;
	if (kind === 'image')
		return (
			<img
				className={p1Classes(large ? 'dashboard-media-thumb' : undefined)}
				src={src}
				alt={result.basename}
				loading="lazy"
			/>
		);
	return (
		<div ref={ref} className={p1Classes(`dashboard-media-video-frame${visible ? ' is-video-mounted' : ''}`)}>
			<div className={p1Classes('dashboard-media-thumb dashboard-media-thumb--video-placeholder')}>
				<Icon className={p1Classes('dashboard-media-thumb-icon')} name="film" />
				{large && formatFileSize(result.size) && (
					<div className={p1Classes('dashboard-media-size-badge')}>{formatFileSize(result.size)}</div>
				)}
			</div>
			{visible && <MediaVideo key={src} src={src} className={p1Classes('dashboard-media-thumb')} />}
			{large && <Icon className={p1Classes('dashboard-media-play')} name="play" />}
		</div>
	);
}
function Tags({ tags, limit }: { tags: string[]; limit: number }) {
	return (
		<>
			{tags.slice(0, limit).map((tag) => (
				<span key={tag} className={p1Classes('dashboard-media-tile-tag')}>
					{tag}
				</span>
			))}
			{tags.length > limit && (
				<span className={p1Classes('dashboard-media-tile-tag dashboard-media-tile-tag--more')}>
					+{tags.length - limit}
				</span>
			)}
		</>
	);
}
function MediaName({ app, result, refresh }: { app: App; result: MediaFileResult; refresh: () => void }) {
	const [editing, setEditing] = useState(false),
		[name, setName] = useState(result.basename);
	const input = useRef<HTMLInputElement>(null),
		finishing = useRef(false);
	useLayoutEffect(() => {
		if (editing) {
			finishing.current = false;
			input.current?.focus();
			input.current?.select();
		}
	}, [editing]);
	const finish = async (save: boolean) => {
		if (finishing.current) return;
		finishing.current = true;
		setEditing(false);
		const next = name.trim();
		if (!save || !next || next === result.basename) {
			setName(result.basename);
			return;
		}
		try {
			await renameMediaFile(app, result.file, next);
			refresh();
		} catch (error) {
			console.error('[Dashboard] media rename failed', error);
			new Notice(t('media.renameFailed'));
			setName(result.basename);
		}
	};
	return (
		<div
			className={p1Classes('dashboard-media-list-name dashboard-media-table-name-cell')}
			onDoubleClick={(e) => {
				e.stopPropagation();
				setEditing(true);
			}}
		>
			{editing ? (
				<input
					ref={input}
					className={p1Classes('dashboard-library-table-edit-input')}
					value={name}
					onInput={(e) => setName(e.currentTarget.value)}
					onBlur={() => void finish(true)}
					onKeyDown={(e) => {
						if (e.nativeEvent.isComposing) return;
						if (e.key === 'Enter' || e.key === 'Escape') {
							e.preventDefault();
							void finish(e.key === 'Enter');
						}
					}}
				/>
			) : (
				name
			)}
		</div>
	);
}
export function MediaViews({
	app,
	results,
	kind,
	size,
	view,
	open,
	remove,
	refresh,
	openNote,
	editTags,
}: {
	app: App;
	results: MediaFileResult[];
	kind: MediaKind;
	size: ThumbSize;
	view: 'grid' | 'list';
	open: (index: number) => void;
	remove: (file: ContentFile) => void;
	refresh: () => void;
	openNote?: (file: ContentFile) => void;
	editTags?: (result: MediaFileResult) => void;
}) {
	const grid = view === 'grid';
	return (
		<div
			className={p1Classes(grid ? `dashboard-media-grid dashboard-media-grid--${size}` : 'dashboard-media-list')}
		>
			{results.map((result, index) => {
				const links = grid ? [] : getMediaBacklinks(app, result.file);
				return (
					<div
						key={result.path}
						className={p1Classes(grid ? 'dashboard-media-item' : 'dashboard-media-list-row')}
						role={grid ? 'group' : undefined}
						onClick={grid ? () => open(index) : undefined}
					>
						{grid ? (
							<button
								type="button"
								aria-label={result.basename}
								className="contents"
								onClick={(event) => {
									event.stopPropagation();
									open(index);
								}}
							>
								<Thumb app={app} result={result} kind={kind} large />
							</button>
						) : (
							<div
								className={p1Classes('dashboard-media-list-thumb')}
								role="button"
								tabIndex={0}
								onKeyDown={(event) => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										event.currentTarget.click();
									}
								}}
								onClick={() => open(index)}
							>
								<Thumb app={app} result={result} kind={kind} large={false} />
							</div>
						)}
						{grid ? (
							<>
								<div
									className={p1Classes('dashboard-media-name')}
									title={`${result.path}\n${formatDate(result.mtime)}`}
								>
									{result.basename}
								</div>
								{result.tags.length > 0 && (
									<div className={p1Classes('dashboard-media-tile-tags')}>
										<Tags tags={result.tags} limit={2} />
									</div>
								)}
							</>
						) : (
							<div className={p1Classes('dashboard-media-list-info')}>
								<MediaName app={app} result={result} refresh={refresh} />
								<div className={p1Classes('dashboard-media-list-meta')}>
									{result.path} · {formatDate(result.mtime)}
								</div>
								{result.tags.length > 0 && (
									<div className={p1Classes('dashboard-media-list-tags')}>
										<Tags tags={result.tags} limit={3} />
									</div>
								)}
								{links.length ? (
									<div className={p1Classes('dashboard-media-backlinks')}>
										{links.slice(0, 5).map((file) => (
											<div
												key={file.path}
												className={p1Classes('dashboard-media-backlink')}
												role="button"
												tabIndex={0}
												onKeyDown={(event) => {
													if (event.key === 'Enter' || event.key === ' ') {
														event.preventDefault();
														event.currentTarget.click();
													}
												}}
												title={file.path}
												onClick={(e) => {
													e.stopPropagation();
													openNote?.(file);
												}}
											>
												{file.basename}
											</div>
										))}
										{links.length > 5 && (
											<div
												className={p1Classes(
													'dashboard-media-backlink dashboard-media-backlink--more',
												)}
											>
												+{links.length - 5}
											</div>
										)}
									</div>
								) : (
									<div className={p1Classes('dashboard-media-no-links')}>—</div>
								)}
							</div>
						)}
						{editTags && (
							<button
								className={p1Classes(
									grid
										? 'dashboard-media-delete dashboard-media-tagbtn'
										: 'dashboard-media-icon-btn dashboard-media-tagbtn dashboard-media-tagbtn--list',
								)}
								aria-label={t('media.editTags')}
								onClick={(e) => {
									e.stopPropagation();
									editTags(result);
								}}
							>
								<Icon name="tags" />
							</button>
						)}
						<button
							className={p1Classes(
								grid
									? 'dashboard-media-delete dashboard-media-delete--grid'
									: 'dashboard-media-icon-btn dashboard-media-delete--list',
							)}
							aria-label={t('media.delete')}
							onClick={(e) => {
								e.stopPropagation();
								remove(result.file);
							}}
						>
							<Icon name="trash-2" />
						</button>
					</div>
				);
			})}
		</div>
	);
}
