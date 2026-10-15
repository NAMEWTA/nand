// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/media-lightbox-modal.ts
import type { App } from 'obsidian';
import { createElement } from 'react';
import type { ContentFile } from '../../../../host/obsidian/storage/content-files';
import { openRecordOverlay } from '../dialogs/open-record-dialog';
import { MediaLightbox } from './MediaLightbox';
export interface MediaTagHooks {
	getTags(file: ContentFile): string[];
	getAllTags(): string[];
	onTagsChange(file: ContentFile, tags: string[]): void;
}
export class MediaLightboxModal {
	private dispose?: () => void;
	constructor(
		private app: App,
		private files: ContentFile[],
		private index: number,
		private kind: 'image' | 'video',
		private tagHooks?: MediaTagHooks,
		private doc?: Document,
	) {}
	open(): void {
		this.dispose = openRecordOverlay(this.doc ?? this.app.workspace.containerEl.ownerDocument, (close) =>
			createElement(MediaLightbox, {
				app: this.app,
				files: this.files,
				startIndex: this.index,
				kind: this.kind,
				tagHooks: this.tagHooks,
				close,
			}),
		);
	}
	close(): void {
		this.dispose?.();
		this.dispose = undefined;
	}
}
