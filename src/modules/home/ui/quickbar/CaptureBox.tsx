// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/quick-note-section.ts
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { ArrowUp, Pencil, Plus } from 'lucide-react';
import { Textarea } from '../../../../ui/components/textarea';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import { IconButton } from '../board/controls';
export function CaptureBox({ store }: { store: BoardStore }) {
	const ref = useRef<HTMLDivElement>(null),
		doc = useOwnerDocument();

	const { settings, files, captureDraft: text } = useStore(store.state),
		[expanded, setExpanded] = useState(() => !!store.captureDraft),
		[open, setOpen] = useState(false),
		[index, setIndex] = useState(0),
		t = useT();
	useEffect(() => {
		const close = (e: PointerEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		};
		doc.addEventListener('pointerdown', close);
		return () => doc.removeEventListener('pointerdown', close);
	}, [doc]);
	const search = settings.quickCaptureMode === 'search',
		matches = files
			.filter((file) => !text || file.basename.toLowerCase().includes(text.toLowerCase()))
			.slice(0, 12);
	const submit = () => {
		if (search) {
			const file = matches[index];
			if (file) void store.openFile(file.path).then(() => setOpen(false));
		} else if (text.trim())
			void store.capture(text).then(() => {
				store.setCaptureDraft('');
			});
	};
	return (
		<div
			ref={ref}
			className={`dashboard-capture relative flex items-center gap-1 rounded-full border border-[var(--db-border-input)] bg-[var(--db-bg-input)] px-2 ${expanded ? 'min-w-[120px] flex-1' : 'min-w-0 @[700px]:min-w-[120px] @[700px]:flex-1'}`}
		>
			<IconButton
				label={t('home.dashboard.capture')}
				className="size-5 shrink-0 text-muted-foreground"
				onClick={() => {
					setExpanded(true);
					doc.defaultView?.requestAnimationFrame(() => ref.current?.querySelector('textarea')?.focus());
				}}
			>
				<Pencil className="size-3" />
			</IconButton>
			<Textarea
				aria-label={t(search ? 'home.dashboard.findNote' : 'home.dashboard.capture')}
				placeholder={t(search ? 'home.dashboard.findNote' : 'home.dashboard.capture')}
				rows={1}
				className={`min-h-7 max-h-28 h-7 resize-none min-w-0 flex-1 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 ${expanded ? '' : 'hidden @[700px]:block'}`}
				value={text}
				onFocus={() => setOpen(true)}
				onChange={(e) => {
					store.setCaptureDraft(e.target.value);
					setIndex(0);
					setOpen(true);
				}}
				onKeyDown={(e) => {
					if (e.nativeEvent.isComposing) return;
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						submit();
					}
					if (e.key === 'ArrowDown') {
						e.preventDefault();
						setIndex((i) => Math.min(matches.length - 1, i + 1));
					}
					if (e.key === 'ArrowUp') {
						e.preventDefault();
						setIndex((i) => Math.max(0, i - 1));
					}
					if (e.key === 'Escape') setOpen(false);
				}}
			/>
			<IconButton
				label={t(search ? 'home.dashboard.recent' : 'home.dashboard.capture')}
				className={`size-5 rounded-full ${expanded ? '' : 'hidden @[700px]:inline-flex'}`}
				onClick={
					search
						? () => {
								store.setCaptureDraft('');
								setOpen((v) => !v);
							}
						: submit
				}
			>
				{search ? <Plus className="size-3" /> : <ArrowUp className="size-3" />}
			</IconButton>
			{search && open && (
				<div className="absolute top-full right-0 left-0 z-[var(--layer-menu)] mt-1 max-h-72 overflow-y-auto rounded-[var(--db-radius-md)] border bg-popover p-1 shadow-floating">
					{matches.map((file, i) => (
						<Button
							key={file.path}
							variant={i === index ? 'secondary' : 'ghost'}
							className="h-8 w-full justify-start truncate text-xs"
							onClick={() => {
								void store.openFile(file.path).then(() => setOpen(false));
							}}
						>
							{file.basename}
						</Button>
					))}
				</div>
			)}
		</div>
	);
}
