// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/ui/thread-card.ts, src/ui/replies.ts
import { useCallback, useState, type ReactNode } from 'react';
import { ArrowUpRight, Check, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CommentThread } from '../../core/model';
import type { CommentsEnv } from '../env';
import { Button } from '../../../../ui/components/button';
import { Badge } from '../../../../ui/components/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/components/tooltip';
import { ConfirmDialog } from '../../../../ui/components/nand/ConfirmDialog';
import { RelativeTime } from '../../../../ui/components/nand/RelativeTime';
import { useT } from '../../../../ui/react/hooks';
import { Composer } from '../popover/Composer';
import { CommentBody } from './CommentBody';
import { jumpToComment, reanchorFromSelection } from '../navigation';

export function Action({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
	return <Tooltip><TooltipTrigger asChild><Button type="button" size="icon-xs" variant="ghost" aria-label={label} onClick={onClick}>{children}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}
export function ThreadCard({ env, path, thread, onDraft, alwaysOpen = false }: {
	env: CommentsEnv; path: string; thread: CommentThread; onDraft?: (key: string, active: boolean) => void; alwaysOpen?: boolean;
}) {
	const t = useT();
	const service = env.service;
	const [editing, setEditing] = useState<string | null>(null);
	const [replying, setReplying] = useState(false);
	const [attaching, setAttaching] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [error, setError] = useState(false);
	const draft = useCallback((active: boolean) => onDraft?.(thread.id, active), [onDraft, thread.id]);
	const run = (action: () => Promise<unknown>) => { setError(false); void action().catch(() => setError(true)); };
	const jump = () => { for (const view of env.editors) env.overlay(view.dom.ownerDocument).close(false); void jumpToComment(env, path, thread); };
	const collapsed = thread.status === 'resolved' && !expanded;
	return <article data-thread-id={thread.id} data-status={thread.status} className={`group space-y-2 rounded-md border border-border bg-card p-3 text-card-foreground ${thread.status === 'resolved' ? 'opacity-60' : ''}`}
		onClick={event => { if (event.target === event.currentTarget) jump(); }}>
		<button type="button" className="line-clamp-2 w-full whitespace-normal break-words border-l-2 border-primary pl-2 text-left text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" title={thread.anchor.text} onClick={jump} aria-label={t('editor.comments.jump')}>
			{thread.kind === 'line' && <span>{t('editor.comments.line', { line: thread.anchor.lineHint })} · </span>}{thread.anchor.text || t('editor.comments.line', { line: thread.anchor.lineHint })}
		</button>
		{thread.status === 'orphaned' && <div className="space-y-1 text-xs"><Badge variant="outline" className="text-status-warning">{t('editor.comments.orphaned')}</Badge><p className="text-muted-foreground">{t('editor.comments.orphanHint')}</p><Button size="xs" variant="outline" onClick={() => setAttaching(true)}>{t('editor.comments.reanchor')}</Button>{attaching && <><p>{t('editor.comments.reattachHint')}</p><Button size="sm" onClick={() => run(async () => { await reanchorFromSelection(env, path, thread); setAttaching(false); })}>{t('editor.comments.confirmAnchor')}</Button></>}</div>}
		{collapsed ? <div className="flex items-center gap-2"><Button variant="ghost" size="xs" onClick={() => setExpanded(true)}>{t('editor.comments.resolved')}</Button><Button variant="ghost" size="xs" onClick={() => run(() => service.status(thread.id, false))}>{t('editor.comments.reopen')}</Button></div> : <>
		{thread.messages.map((message, index) => {
			const canEdit = !message.author || message.author === service.settings().author;
			return <div key={message.id} className={index ? 'ml-3 space-y-1 border-l border-border pl-3' : 'space-y-1'}>
				<div className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground"><span className="text-xs font-medium text-foreground">{message.author || t('editor.comments.you')}</span><RelativeTime value={message.createdAt} />{message.editedAt && <span>{t('editor.comments.edited')}</span>}</div>
				{editing === message.id ? <Composer app={env.app} initial={message.text} submitLabel={t('editor.comments.save')} onDraft={draft} onCancel={() => setEditing(null)} onSubmit={async text => { await service.edit(thread.id, message.id, text); setEditing(null); }} /> : <CommentBody app={env.app} path={path} text={message.text} onEdit={canEdit ? () => setEditing(message.id) : undefined} />}
				<div className={`flex justify-end gap-2 ${alwaysOpen ? '' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100'}`}>
				{index === 0 && thread.status !== 'orphaned' && <Action label={t(thread.status === 'resolved' ? 'editor.comments.reopen' : 'editor.comments.resolve')} onClick={() => run(() => service.status(thread.id, thread.status !== 'resolved'))}>{thread.status === 'resolved' ? <RotateCcw /> : <Check />}</Action>}
				{canEdit && !editing && <Action label={t(index ? 'editor.comments.editReply' : 'editor.comments.edit')} onClick={() => setEditing(message.id)}><Pencil /></Action>}
				{index === 0 ? <ConfirmDialog title={t('editor.comments.delete')} description={t('editor.comments.deleteConfirm', { count: thread.messages.length - 1 })} destructive onConfirm={() => service.remove(thread.id)}><Button variant="ghost" size="icon-xs" aria-label={t('editor.comments.delete')} title={t('editor.comments.delete')}><Trash2 /></Button></ConfirmDialog> : <Action label={t('editor.comments.deleteReply')} onClick={() => run(async () => {
					const removed = await service.removeReply(thread.id, message.id);
					if (removed) toast(t('editor.comments.deleted'), { duration: 5000, action: { label: t('editor.comments.undo'), onClick: () => run(() => service.restoreReply(thread.id, removed)) } });
				})}><Trash2 /></Action>}
				{index === 0 && <Action label={t('editor.comments.jump')} onClick={jump}><ArrowUpRight /></Action>}
				</div>
			</div>;
		})}
		{!editing && (replying ? <Composer app={env.app} submitLabel={t('editor.comments.reply')} onDraft={draft} onCancel={() => setReplying(false)} onSubmit={async (text, key) => { await service.reply(key, thread.id, text); setReplying(false); }} /> : <Button variant="ghost" size="xs" className="w-full justify-start text-muted-foreground" onClick={() => setReplying(true)}>{t('editor.comments.reply')}…</Button>)}
		</>}
		{error && <p role="alert" className="text-xs text-destructive">{t('editor.comments.storageFailed')}</p>}
	</article>;
}
