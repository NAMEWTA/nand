// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/ui/thread-popover.ts, src/editor/bottom-sheet.ts
import { useCallback, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { Platform } from 'obsidian';
import { Pin, X } from 'lucide-react';
import type { CommentsEnv } from '../env';
import type { OverlayChannel } from '../../services/overlay';
import { Popover, PopoverAnchor, PopoverContent } from '../../../../ui/components/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../../../../ui/components/sheet';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '../../../../ui/components/alert-dialog';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import { Composer } from './Composer';
import { Action, ThreadCard } from '../thread/ThreadCard';

export function CommentPopover({ env, channel }: { env: CommentsEnv; channel: OverlayChannel }) {
	const { request, revision } = useStore(channel.state);
	useStore(env.service.state, state => state.revision);
	const t = useT();
	const drafts = useRef(new Set<string>());
	const content = useRef<HTMLDivElement>(null);
	const onDraft = useCallback((key: string, active: boolean) => {
		if (active) drafts.current.add(key); else drafts.current.delete(key);
		channel.setDraft(drafts.current.size > 0);
	}, [channel]);
	const virtualRef = useMemo(() => ({ current: { getBoundingClientRect: () => request?.rect() ?? new DOMRect() } }), [request]);
	if (!request) return null;
	const close = () => channel.close();
	const escape = (event: KeyboardEvent) => {
		if (request.mode !== 'threads' || !channel.state.getState().draft) return;
		event.preventDefault();
		content.current?.querySelectorAll('form').forEach(form => form.dispatchEvent(new request.ownerDocument.defaultView!.Event('nand-comment-cancel')));
	};
	const body = request.mode === 'selection' ? <Button size="xs" variant="secondary" onClick={() => channel.open({ ...request, mode: 'compose', pinned: true })}>{t('editor.comments.popover')}</Button> : request.mode === 'compose' && request.anchor ? <Composer app={env.app} key={`${request.path}:${request.anchor.start}:${request.anchor.end}`} onCancel={close} onSubmit={async (text, key) => {
		await env.service.add(key, request.path, { anchor: request.anchor!, text }); close();
	}}><div className="text-2xs text-muted-foreground">{t('editor.comments.author')}: {env.service.settings().author || <Button size="xs" variant="link" onClick={() => env.openSettings()}>{t('editor.comments.setAuthor')}</Button>}</div></Composer> : <>
		<div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>{t('editor.comments.title')} ({request.threadIds?.length ?? 0})</span><div className="flex gap-2"><Action label={t(request.pinned ? 'editor.comments.pinned' : 'editor.comments.pin')} onClick={() => channel.pin()}><Pin /></Action><Action label={t('editor.comments.close')} onClick={close}><X /></Action></div></div>
		<div className="space-y-2">{env.service.store.threadsFor(request.path).filter(thread => request.threadIds?.includes(thread.id)).map(thread => <ThreadCard key={thread.id} path={request.path} thread={thread} env={env} onDraft={onDraft} alwaysOpen />)}</div>
	</>;
	if (request.mode === 'resolve-all') return <AlertDialog open onOpenChange={open => { if (!open) close(); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('editor.comments.resolveAll')}</AlertDialogTitle><AlertDialogDescription>{t('editor.comments.resolveAllConfirm')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t('editor.comments.cancel')}</AlertDialogCancel><AlertDialogAction onClick={event => { event.preventDefault(); void env.service.resolveAll(request.path).then(close, () => undefined); }}>{t('editor.comments.resolve')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
	if (Platform.isPhone && request.mode !== 'selection') return <Sheet open onOpenChange={open => { if (!open) close(); }}><SheetContent ref={content} data-comments-overlay={request.mode} side="bottom" className="max-h-[80vh] overflow-y-auto p-4" onEscapeKeyDown={escape} onCloseAutoFocus={event => { event.preventDefault(); request.focus?.(); }}><SheetHeader><SheetTitle>{t('editor.comments.title')}</SheetTitle><SheetDescription className="sr-only">{request.path}</SheetDescription></SheetHeader>{body}</SheetContent></Sheet>;
	return <Popover open onOpenChange={open => { if (!open) close(); }}>
		<PopoverAnchor virtualRef={virtualRef} />
		<PopoverContent aria-label={t('editor.comments.title')} ref={content} data-comments-overlay={request.mode} data-position-revision={revision} side={request.mode === 'selection' ? 'top' : 'right'} align="start" sideOffset={8} collisionPadding={12}
			className={request.mode === 'selection' ? 'p-0' : 'w-[360px] max-w-[calc(100vw-24px)] max-h-[min(480px,70vh)] overflow-y-auto p-3'}
			onOpenAutoFocus={event => { if (request.mode !== 'compose') event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); request.focus?.(); }}
			onPointerOver={() => channel.setHovered(true)} onPointerLeave={() => { channel.setHovered(false); channel.scheduleClose(); }} onEscapeKeyDown={escape}
			onInteractOutside={event => { if (channel.state.getState().draft) event.preventDefault(); }}>
			{body}
		</PopoverContent>
	</Popover>;
}
