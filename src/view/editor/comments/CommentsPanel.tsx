import type { CommentThread } from '../../../core/comments/model';
import { t } from '../../../shared/i18n';
import { EmptyState } from '../../primitives/EmptyState';
import { Icon } from '../../primitives/Icon';

export interface CommentPanelActions {
	jump(thread: CommentThread): void;
	reanchor(thread: CommentThread): void;
	resolve(id: string): void;
	reopen(id: string): void;
	reply(id: string): void;
	more(thread: CommentThread, button: HTMLButtonElement): void;
}
export function CommentsPanel({
	path,
	threads,
	focusedId,
	actions,
	formatTime,
}: {
	path: string | null;
	threads: readonly CommentThread[];
	focusedId: string | null;
	actions: CommentPanelActions;
	formatTime: (ts: string) => string;
}) {
	return (
		<>
			<div className="nand-editor-comments-head">
				<div className="nand-editor-comments-title">{t('editor.comments.title')}</div>
				{path && (
					<div className="nand-editor-comments-path" title={path}>
						{path}
					</div>
				)}
			</div>
			{!path || !threads.length ? (
				<EmptyState
					icon={path ? 'message-square' : 'file-text'}
					title={t('editor.comments.title')}
					description={t(path ? 'editor.comments.empty' : 'editor.comments.noFile')}
				/>
			) : (
				<div className="nand-editor-comments-list">
					{threads.map((thread) => (
						<div
							key={thread.id}
							className={`nand-editor-comment${focusedId === thread.id ? ' is-focused' : ''}`}
							data-comment-id={thread.id}
							data-status={thread.status}
						>
							<button
								type="button"
								className="nand-editor-comment-quote"
								aria-label={`${t('editor.comments.jump')}: ${thread.target.quote.exact || '…'}`}
								onClick={() => actions.jump(thread)}
							>
								{thread.target.quote.exact || '…'}
							</button>
							{thread.status !== 'open' && (
								<div className="nand-editor-comment-status">
									<Icon name={thread.status === 'resolved' ? 'check-check' : 'unlink'} />
									<span>
										{t(
											thread.status === 'resolved'
												? 'editor.comments.resolved'
												: 'editor.comments.orphaned',
										)}
									</span>
								</div>
							)}
							<div className="nand-editor-comment-messages">
								{thread.thread.map((message, index) => (
									<div key={index} className="nand-editor-comment-message">
										<div className="nand-editor-comment-text">{message.text}</div>
										<div className="nand-editor-comment-time">{formatTime(message.ts)}</div>
									</div>
								))}
							</div>
							<div className="nand-editor-comment-actions">
								{thread.status === 'orphaned' ? (
									<button onClick={() => actions.reanchor(thread)}>
										{t('editor.comments.reanchor')}
									</button>
								) : thread.status === 'open' ? (
									<button onClick={() => actions.resolve(thread.id)}>
										{t('editor.comments.resolve')}
									</button>
								) : (
									<button onClick={() => actions.reopen(thread.id)}>
										{t('editor.comments.reopen')}
									</button>
								)}
								<button onClick={() => actions.reply(thread.id)}>{t('editor.comments.reply')}</button>
								<button
									type="button"
									className="nand-editor-comment-more"
									aria-label={t('editor.comments.more')}
									aria-haspopup="menu"
									onClick={(event) => actions.more(thread, event.currentTarget)}
								>
									<Icon name="ellipsis" />
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</>
	);
}
