import { serviceKey } from '../../app/contracts/module';

/** The comments side panel (`nand-comments-view`) renders through this while the module is active. */
export interface CommentsPanel {
	/** Render the panel for the active note into `container`; returns the cleanup. */
	mount(container: HTMLElement): () => void;
}

/** A note with comments, from the comment index. */
export interface CommentedNote {
	path: string;
	open: number;
	total: number;
	updatedAt: string;
}

/** Notes with comments, kept current while the module is active (service `comments.index`). */
export interface CommentsIndex {
	notes(): readonly CommentedNote[];
	subscribe(listener: () => void): () => void;
}

export const COMMENTS_PANEL = serviceKey<CommentsPanel>('comments', 'panel');
export const COMMENTS_INDEX = serviceKey<CommentsIndex>('comments', 'index');
