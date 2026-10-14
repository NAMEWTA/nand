// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts
import { useEffect, useRef, useState } from 'react';
import { Component, MarkdownRenderer } from 'obsidian';
import type { BoardStore } from '../../services/board-store';
import { Textarea } from '../../../../ui/components/textarea';
import { useT } from '../../../../ui/react/hooks';
import { useOwnerDocument } from '../../../../ui/react/contexts';
export function MarkdownBody({ text, store, sourcePath }: { text: string; store: BoardStore; sourcePath?: string }) {
	const ref = useRef<HTMLDivElement>(null),
		doc = useOwnerDocument();
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const component = new Component();
		component.load();
		el.replaceChildren();
		void MarkdownRenderer.render(
			store.host.app,
			text,
			el,
			sourcePath ?? store.state.getState().path + '.md',
			component,
		);
		return () => {
			component.unload();
			el.replaceChildren();
		};
	}, [text, store, doc, sourcePath]);
	return (
		<div
			ref={ref}
			className="nand-native markdown-rendered min-w-0 text-[.85em]"
			onClick={(e) => {
				const link = (e.target as Element).closest<HTMLAnchorElement>('a.internal-link');
				if (link) {
					e.preventDefault();
					void store.openFile(link.dataset.href ?? link.getAttribute('href') ?? '', false, sourcePath);
				}
			}}
		/>
	);
}
export function MemoBody({
	store,
	text,
	onSave,
	cardId,
}: {
	store: BoardStore;
	text: string;
	cardId: string;
	onSave(this: void, text: string, original: string): Promise<void>;
}) {
	const draftKey = store.memoDraftKey(cardId);
	const cancelled = useRef(false),
		saving = useRef(false);
	const save = () => {
		if (cancelled.current || saving.current) return;
		saving.current = true;
		void onSave(draft, original.current)
			.then(() => setEditing(false))
			.catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t('workbench.failed')))
			.finally(() => {
				saving.current = false;
			});
	};
	const t = useT(),
		[editing, setEditing] = useState(() => store.memoDrafts.has(draftKey)),
		[draft, setDraft] = useState(() => store.memoDrafts.get(draftKey)?.text ?? text),
		[error, setError] = useState(''),
		original = useRef(store.memoDrafts.get(draftKey)?.original ?? text);
	const begin = () => {
		cancelled.current = false;
		original.current = text;
		setDraft(text);
		setError('');
		store.memoDrafts.set(draftKey, { original: text, text });
		setEditing(true);
	};
	if (editing)
		return (
			<div className="flex min-h-0 flex-1 flex-col gap-1">
				<Textarea
					autoFocus
					aria-label={t('home.dashboard.memo')}
					className="min-h-28 flex-1 resize-none text-sm"
					value={draft}
					onChange={(e) => {
						setDraft(e.target.value);
						store.memoDrafts.set(draftKey, {
							...store.memoDrafts.get(draftKey),
							original: original.current,
							text: e.target.value,
						});
					}}
					onBlur={() => {
						save();
					}}
					onKeyDown={(e) => {
						if (e.key === 'Escape') {
							cancelled.current = true;
							store.memoDrafts.delete(draftKey);
							setEditing(false);
						}
						if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) {
							save();
						}
					}}
				/>
				{error && (
					<p role="alert" className="m-0 text-xs text-destructive">
						{error}
					</p>
				)}
			</div>
		);
	return (
		<div
			className="min-h-0 flex-1 cursor-text overflow-y-auto "
			role="button"
			tabIndex={0}
			aria-label={t('common.edit')}
			onKeyDown={(event) => {
				if (event.key === 'Enter') {
					begin();
				}
			}}
			onClick={(event) => {
				if ((event.target as Element).closest('a')) return;
				begin();
			}}
		>
			<div className="rounded-[var(--db-radius-sm)] bg-[var(--db-bg-input)] p-[10px]">
				<MarkdownBody text={text} store={store} />
			</div>
		</div>
	);
}
