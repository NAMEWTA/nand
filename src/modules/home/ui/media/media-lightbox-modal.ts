import { App, Modal, type TFile } from 'obsidian';
import { h } from 'preact';
import {
	bindRenderContext,
	DashboardRenderContext,
	mountDashboardPanel,
	unmountDashboardPanelsIn,
} from '../renderer/render-context';
import { MediaLightboxPanel } from './MediaLightboxPanel';
export interface MediaTagHooks {
	getTags(file: TFile): string[];
	getAllTags(): string[];
	onTagsChange(file: TFile, tags: string[]): void;
}

export class MediaLightboxModal extends Modal {
	private index: number;
	private readonly backdrop = (event: MouseEvent) => {
		if (event.target === this.contentEl) this.close();
	};
	constructor(
		app: App,
		private readonly files: TFile[],
		startIndex: number,
		private readonly kind: 'image' | 'video',
		private readonly tagHooks?: MediaTagHooks,
	) {
		super(app);
		this.index = Math.max(0, Math.min(startIndex, files.length - 1));
	}
	onOpen(): void {
		this.contentEl.addClass('dashboard-media-lightbox');
		this.modalEl.addClass('dashboard-media-lightbox-modal');
		this.containerEl.addClass('dashboard-media-lightbox-container');
		bindRenderContext(this.contentEl, new DashboardRenderContext(this.contentEl));
		this.scope.register([], 'ArrowLeft', () => {
			this.show(this.index - 1);
			return false;
		});
		this.scope.register([], 'ArrowRight', () => {
			this.show(this.index + 1);
			return false;
		});
		this.contentEl.addEventListener('click', this.backdrop);
		this.renderCurrent();
	}
	private show(index: number): void {
		if (index < 0 || index >= this.files.length) return;
		this.index = index;
		this.renderCurrent();
	}
	private renderCurrent(): void {
		mountDashboardPanel(
			this.contentEl,
			h(MediaLightboxPanel, {
				app: this.app,
				files: this.files,
				index: this.index,
				kind: this.kind,
				tagHooks: this.tagHooks,
				show: (index) => this.show(index),
				close: () => this.close(),
			}),
		);
	}
	onClose(): void {
		this.contentEl.removeEventListener('click', this.backdrop);
		unmountDashboardPanelsIn(this.contentEl);
		this.contentEl.empty();
	}
}
