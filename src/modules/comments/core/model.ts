// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/types.ts
export type CommentStatus = 'open' | 'resolved' | 'orphaned';
export interface TextAnchorV2 {
	kind: 'range' | 'line';
	text: string;
	textHash: string;
	before: string;
	after: string;
	lineHint: number;
	start: number;
	end: number;
}
export interface CommentMessage {
	id: string;
	author: string;
	text: string;
	createdAt: string;
	editedAt?: string;
}
export interface CommentThread {
	id: string;
	kind: 'range' | 'line';
	status: CommentStatus;
	anchor: TextAnchorV2;
	messages: CommentMessage[];
	createdAt: string;
	updatedAt: string;
}
export interface CommentFileDoc { version: 2; path: string; threads: CommentThread[] }
export interface CommentIndexEntry { hash: string; open: number; total: number; updatedAt: string }
export interface CommentIndex { version: 2; files: Record<string, CommentIndexEntry> }
export interface NewCommentInput { anchor: TextAnchorV2; text: string; author?: string }
