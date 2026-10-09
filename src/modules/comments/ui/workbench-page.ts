import { TFile } from 'obsidian';
import { h, render } from 'preact';
import type { PageCreate } from '../../../app/contracts/workbench-host';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import { onLanguageChanged, t } from '../../../shared/i18n/index';
import { NativeSurface, type NativeSurfaceContext } from '../../../ui/native-surface';
import { Button } from '../../../ui/primitives/Button';
import { EmptyState } from '../../../ui/primitives/EmptyState';
import { mountCommentsPanel } from './comments/panel';
import type { CommentsRuntime } from './runtime';

/** Workbench comments page: the threads of the note picked in the side panel (column 2 lists commented notes). */
class CommentsOverview extends NativeSurface {
	private path = '';
	private unmount: (() => void) | null = null;

	constructor(context: NativeSurfaceContext, private readonly runtime: () => CommentsRuntime | undefined) {
		super(context);
	}
	getViewType(): string {
		return 'nand-comments-overview';
	}
	getDisplayText(): string {
		return t('workbench.comments');
	}
	getIcon(): string {
		return 'message-square';
	}
	onOpen(): Promise<void> {
		this.contentEl.addClass('nand-comments-overview');
		this.register(onLanguageChanged(() => this.draw()));
		this.draw();
		return Promise.resolve();
	}
	onClose(): Promise<void> {
		this.clear();
		return Promise.resolve();
	}
	show(target: WorkbenchTarget): void {
		const path = target.resourceId ?? '';
		if (path === this.path && this.contentEl.hasChildNodes()) return;
		this.path = path;
		this.draw();
	}
	getTarget(section: string | undefined): WorkbenchTarget {
		return { feature: 'comments', section, resourceId: this.path || undefined };
	}
	private clear(): void {
		this.unmount?.();
		this.unmount = null;
		render(null, this.contentEl);
		this.contentEl.empty();
	}
	private draw(): void {
		this.clear();
		const runtime = this.runtime();
		const file = this.path ? this.app.vault.getFileByPath(this.path) : null;
		if (!runtime || !file) {
			render(h(EmptyState, { icon: 'message-square', title: t(this.path ? 'workbench.commentsNoteMissing' : 'workbench.commentsPick'), description: '', layout: 'content' }), this.contentEl);
			return;
		}
		const header = this.contentEl.createDiv({ cls: 'nand-comments-overview-header' });
		header.createEl('h2', { cls: 'nand-comments-overview-title', text: file.basename });
		const actions = header.createDiv();
		render(h(Button, { size: 'sm', icon: 'file-text', onClick: () => { void this.openNote(file); } }, t('workbench.openNote')), actions);
		const body = this.contentEl.createDiv({ cls: 'nand-comments-overview-body' });
		this.unmount = mountCommentsPanel(body, { app: this.app, file, store: runtime.env.store() });
	}
	private async openNote(file: TFile): Promise<void> {
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.openFile(file, { active: true });
		await this.app.workspace.revealLeaf(leaf);
	}
}

export const createCommentsPage = (runtime: () => CommentsRuntime | undefined): PageCreate => async (context, target) => {
	const surface = new CommentsOverview(context, runtime);
	let section = target.section;
	surface.show(target);
	return {
		surface,
		getTarget: () => surface.getTarget(section),
		navigate: async (next) => {
			section = next.section;
			surface.show(next);
		},
	};
};
