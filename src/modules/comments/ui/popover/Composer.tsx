// Adapted from jonaas-dev/obsidian-margin-comments f727e38 (MIT), Copyright (c) 2026 jonaas-dev: src/editor/floating-comment.ts, src/ui/thread-card.ts
import { Scope, type App } from 'obsidian';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../../../ui/components/button';
import { Textarea } from '../../../../ui/components/textarea';
import { Label } from '../../../../ui/components/label';
import { useT } from '../../../../ui/react/hooks';

/** Shared new-comment / reply / inline-edit form. Draft survives a rejected durable write. */
export function Composer({ app, initial = '', submitLabel, onSubmit, onCancel, onDraft, children }: {
	app?: App; initial?: string; submitLabel?: string; onSubmit: (text: string, key: object) => Promise<void>; onCancel: () => void;
	onDraft?: (dirty: boolean) => void; children?: React.ReactNode;
}) {
	const t = useT();
	const id = useId();
	const input = useRef<HTMLTextAreaElement>(null);
	const key = useRef({});
	const form = useRef<HTMLFormElement>(null);
	useEffect(() => { const el = form.current; el?.addEventListener('nand-comment-cancel', onCancel); return () => el?.removeEventListener('nand-comment-cancel', onCancel); }, [onCancel]);
	const submitting = useRef(false);
	const [text, setText] = useState(initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(false);
	useEffect(() => {
		onDraft?.(true);
		const el = input.current;
		const win = el?.ownerDocument.defaultView;
		const frame = win?.requestAnimationFrame(() => el?.focus());
		return () => { if (frame !== undefined) win?.cancelAnimationFrame(frame); onDraft?.(false); };
	}, [onDraft]);
	const submit = useCallback(async () => {
		if (submitting.current || !text.trim()) return;
		submitting.current = true; setBusy(true); setError(false);
		try { await onSubmit(text.trim(), key.current); }
		catch { setError(true); input.current?.focus(); }
		finally { submitting.current = false; setBusy(false); }
	}, [onSubmit, text]);
	useEffect(() => {
		const el = form.current;
		if (!app?.keymap || !el) return;
		const scope = new Scope(app.scope);
		let pushed = false;
		const sync = () => {
			const active = el.contains(el.ownerDocument.activeElement);
			if (active && !pushed) { app.keymap.pushScope(scope); pushed = true; }
			if (!active && pushed) { app.keymap.popScope(scope); pushed = false; }
		};
		scope.register(['Mod'], 'Enter', event => {
			if (event.isComposing) return null;
			event.preventDefault(); void submit(); return false;
		});
		scope.register([], 'Escape', event => {
			if (event.isComposing) return null;
			event.preventDefault(); if (!busy) onCancel(); return false;
		});
		el.ownerDocument.addEventListener('focusin', sync); sync();
		return () => { el.ownerDocument.removeEventListener('focusin', sync); if (pushed) app.keymap.popScope(scope); };
	}, [app, busy, onCancel, submit]);

	return <form ref={form} className="space-y-2" onSubmit={event => { event.preventDefault(); void submit(); }} aria-busy={busy}>
		<Label htmlFor={id} className="sr-only">{t('editor.comments.placeholder')}</Label>
		<Textarea ref={input} id={id} value={text} disabled={busy} rows={3} className="min-h-20 resize-y text-[13px]" placeholder={t('editor.comments.placeholder')} aria-describedby={`${id}-help`} aria-invalid={error}
			onChange={event => setText(event.target.value)} onKeyDown={event => {
				if (event.nativeEvent.isComposing) return;
				if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!busy) onCancel(); }
				if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void submit(); }
			}} />
		<div id={`${id}-help`} className="text-2xs text-muted-foreground">{t('editor.comments.shortcut', { modifier: 'Ctrl/Cmd' })}</div>
		{children}
		{error && <p role="alert" className="text-xs text-destructive">{t('editor.comments.saveFailed')}</p>}
		<div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>{t('editor.comments.cancel')}</Button><Button type="submit" size="sm" disabled={busy || !text.trim()}>{error ? t('editor.comments.retry') : submitLabel ?? t('editor.comments.popover')}</Button></div>
	</form>;
}
