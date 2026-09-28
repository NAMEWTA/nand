export { locateAnchor, makeAnchor, selectionIsCommentable } from '../../../core/comments/anchor';
export type { CommentStatus, CommentThread, TextQuoteAnchor } from '../../../core/comments/model';
export { CommentStore, getCommentStore, registerCommentStore } from '../../../core/comments/store';
export type { CommentFs, PosMapper } from '../../../core/comments/store';
export { createCommentsDomain } from './domain';
