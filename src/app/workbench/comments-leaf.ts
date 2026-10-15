import { ItemView, type WorkspaceLeaf } from 'obsidian';
import type { ServiceAccess } from '../contracts/module';
import { COMMENTS_PANEL } from '../../modules/comments/api';
import { t } from '../../shared/i18n';
import { onLeafLanguageChanged } from '../../host/obsidian/workspace-title';

export const COMMENTS_VIEW_TYPE = 'nand-comments-view';

/**
 * The comments side panel. Registered at plugin load so saved leaves restore; while the comments module is
 * off it shows how to turn it on, and it switches to the module's panel as soon as the module starts.
 */
export class CommentsLeaf extends ItemView {
	private unmount: (() => void) | null = null;
	private generation = 0;

	constructor(leaf: WorkspaceLeaf, private readonly host: { services: ServiceAccess; openWorkbenchSettings(category?: string): Promise<void> }) {
		super(leaf);
		this.navigation = false;
	}
	getViewType(): string {
		return COMMENTS_VIEW_TYPE;
	}
	getDisplayText(): string {
		return t('editor.viewTitle');
	}
	getIcon(): string {
		return 'message-square-text';
	}
	onOpen(): Promise<void> {
		this.register(this.host.services.watch(COMMENTS_PANEL, () => this.draw()));
		this.register(onLeafLanguageChanged(this.app, this.leaf, () => {
			if (!this.host.services.peek(COMMENTS_PANEL)) this.draw();
		}));
		this.draw();
		return Promise.resolve();
	}
	onClose(): Promise<void> {
		this.clear();
		return Promise.resolve();
	}
	private clear(): void {
		this.generation++;
		this.unmount?.();
		this.unmount = null;
		this.contentEl.empty();
	}
	private draw(): void {
		this.clear();
		const panel = this.host.services.peek(COMMENTS_PANEL);
		if (panel) {
			this.unmount = panel.mount(this.contentEl);
			return;
		}
		const generation = this.generation;
		void import('./CommentsEmptyState').then(({ mountCommentsEmptyState }) => {
			if (generation !== this.generation) return;
			this.unmount = mountCommentsEmptyState(this.contentEl, () => { void this.host.openWorkbenchSettings('general'); });
		}).catch((error: unknown) => console.error('[NAND] Comments empty state failed', error));
	}
}
