// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/media-section.ts
import { p1Classes } from '../theme/p1-classes';
import type { App } from 'obsidian';
import { type ContentFile } from '../../../../host/obsidian/storage/content-files';
import { useState } from 'react';
import { t } from '../../../../shared/i18n';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
import { resolveVaultImage } from '../banner/image-resource';
import { MediaVideo } from './MediaViews';
import type { MediaTagHooks } from './media-lightbox-modal';
import { MediaTagEditor } from './MediaTagEditor';
export function MediaLightboxPanel({
	app,
	files,
	index,
	kind,
	tagHooks,
	show,
	close,
}: {
	app: App;
	files: ContentFile[];
	index: number;
	kind: 'image' | 'video';
	tagHooks?: MediaTagHooks;
	show: (index: number) => void;
	close: () => void;
}) {
	const [editing, setEditing] = useState(false);
	const [, refresh] = useState(0);
	const file = files[index];
	if (!file) return <div className={p1Classes('dashboard-media-lightbox-empty')}>—</div>;
	const src = resolveVaultImage(app, file.path);
	if (!src) return null;
	return (
		<>
			{editing && tagHooks && (
				<MediaTagEditor
					name={file.basename}
					path={file.path}
					current={tagHooks.getTags(file)}
					known={tagHooks.getAllTags()}
					onClose={() => setEditing(false)}
					onSave={(tags) => {
						tagHooks.onTagsChange(file, tags);
						refresh((n) => n + 1);
						setEditing(false);
					}}
				/>
			)}
			<div
				className={p1Classes('dashboard-media-lightbox-stage')}
				onClick={(e) => {
					if (e.target === e.currentTarget) close();
				}}
			>
				{kind === 'image' ? (
					<img className={p1Classes('dashboard-media-lightbox-img')} src={src} alt={file.basename} />
				) : (
					<MediaVideo key={src} src={src} className={p1Classes('dashboard-media-lightbox-video')} play />
				)}
			</div>
			<div className={p1Classes('dashboard-media-lightbox-caption')}>
				{file.basename} ({index + 1} / {files.length})
			</div>
			{tagHooks && (
				<div className={p1Classes('dashboard-media-lightbox-tags')}>
					{tagHooks.getTags(file).map((tag) => (
						<span key={tag} className={p1Classes('dashboard-media-lightbox-tag')}>
							{tag}
						</span>
					))}
					<div
						className={p1Classes('dashboard-media-lightbox-tag dashboard-media-lightbox-tag--add')}
						role="button"
						onClick={() => setEditing(true)}
					>
						<Icon className={p1Classes('dashboard-media-lightbox-tag-icon')} name="plus" />
						<span>{t('media.editTags')}</span>
					</div>
				</div>
			)}
			<div
				className={p1Classes(
					`dashboard-media-lightbox-nav dashboard-media-lightbox-nav--prev${index <= 0 ? ' is-disabled' : ''}`,
				)}
				role="button"
				onClick={() => show(index - 1)}
			>
				<Icon name="chevron-left" />
			</div>
			<div
				className={p1Classes(
					`dashboard-media-lightbox-nav dashboard-media-lightbox-nav--next${index >= files.length - 1 ? ' is-disabled' : ''}`,
				)}
				role="button"
				onClick={() => show(index + 1)}
			>
				<Icon name="chevron-right" />
			</div>
		</>
	);
}
