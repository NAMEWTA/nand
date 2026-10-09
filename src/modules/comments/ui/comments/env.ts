import type { App } from 'obsidian';
import type { CommentStore } from '../../core/store';
import type { CommentsSettings } from '../../settings';

/** What the comment editor features need: created per module activation, never a global. */
export interface CommentsEnv {
	readonly app: App;
	/** The open store; null while it is loading or after the module stopped. */
	store(): CommentStore | null;
	settings(): CommentsSettings;
}
