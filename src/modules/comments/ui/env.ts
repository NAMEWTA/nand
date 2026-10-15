import type { App } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import type { CommentsService } from '../services/comments';
import type { OverlayChannel, OverlayRequest } from '../services/overlay';

export interface CommentsEnv {
	app: App;
	service: CommentsService;
	editors: Set<EditorView>;
	alive(): boolean;
	overlay(doc: Document): OverlayChannel;
	open(request: OverlayRequest): void;
	openSettings(): void;
}
