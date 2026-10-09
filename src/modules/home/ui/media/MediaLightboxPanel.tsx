import type { App, TFile } from 'obsidian';
import { useState } from 'preact/hooks';
import { t } from '../../../../shared/i18n';
import { Icon } from '../../../../ui/primitives/Icon';
import { resolveVaultImage } from '../banner/banner';
import { MediaVideo } from './MediaViews';
import type { MediaTagHooks } from './media-lightbox-modal';
import { MediaTagEditModal } from './media-tag-editor-modal';
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
	files: TFile[];
	index: number;
	kind: 'image' | 'video';
	tagHooks?: MediaTagHooks;
	show: (index: number) => void;
	close: () => void;
}) {
	const [, refresh] = useState(0);
	const file = files[index];
	if (!file) return <div class="dashboard-media-lightbox-empty">—</div>;
	const src = resolveVaultImage(app, file.path);
	if (!src) return null;
	return (
		<>
			<div
				class="dashboard-media-lightbox-stage"
				onClick={(e) => {
					if (e.target === e.currentTarget) close();
				}}
			>
				{kind === 'image' ? (
					<img class="dashboard-media-lightbox-img" src={src} alt={file.basename} />
				) : (
					<MediaVideo key={src} src={src} className="dashboard-media-lightbox-video" play />
				)}
			</div>
			<div class="dashboard-media-lightbox-caption">
				{file.basename} ({index + 1} / {files.length})
			</div>
			{tagHooks && (
				<div class="dashboard-media-lightbox-tags">
					{tagHooks.getTags(file).map((tag) => (
						<span key={tag} class="dashboard-media-lightbox-tag">
							{tag}
						</span>
					))}
					<div
						class="dashboard-media-lightbox-tag dashboard-media-lightbox-tag--add"
						role="button"
						onClick={() =>
							new MediaTagEditModal(app, file, tagHooks.getTags(file), tagHooks.getAllTags(), (tags) => {
								tagHooks.onTagsChange(file, tags);
								refresh((n) => n + 1);
							}).open()
						}
					>
						<Icon className="dashboard-media-lightbox-tag-icon" name="plus" />
						<span>{t('media.editTags')}</span>
					</div>
				</div>
			)}
			<div
				class={`dashboard-media-lightbox-nav dashboard-media-lightbox-nav--prev${index <= 0 ? ' is-disabled' : ''}`}
				role="button"
				onClick={() => show(index - 1)}
			>
				<Icon name="chevron-left" />
			</div>
			<div
				class={`dashboard-media-lightbox-nav dashboard-media-lightbox-nav--next${index >= files.length - 1 ? ' is-disabled' : ''}`}
				role="button"
				onClick={() => show(index + 1)}
			>
				<Icon name="chevron-right" />
			</div>
		</>
	);
}
