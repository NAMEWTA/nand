// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/view.ts
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { BoardStore } from '../../services/board-store';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import { ResizeHandle } from '../board/ResizeHandle';
import { WidgetDeck } from '../widgets/WidgetDeck';
import { WeekStrip } from './WeekStrip';
import { RecentDocs } from './RecentDocs';
export function Sidebar({ store, stacked = false }: { store: BoardStore; stacked?: boolean }) {
	const settings = useStore(store.state, (s) => s.settings),
		doc = useOwnerDocument(),
		t = useT(),
		[expanded, setExpanded] = useState(false),
		[size, setSize] = useState<number | undefined>(),
		root = useRef<HTMLElement>(null),
		open = settings.sidebarPinned || expanded;
	useEffect(() => {
		if (!expanded || settings.sidebarPinned) return;
		const close = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) setExpanded(false);
		};
		doc.addEventListener('pointerdown', close);
		return () => doc.removeEventListener('pointerdown', close);
	}, [doc, expanded, settings.sidebarPinned]);
	const width = stacked ? settings.sidebarWidth : (size ?? settings.sidebarWidth);
	return (
		<aside
			ref={root}
			className={`dashboard-sidebar relative flex min-h-0 shrink-0 flex-col ${stacked ? 'w-full' : ''}`}
			data-open={open}
			data-stacked={stacked}
			style={{
				width: stacked ? undefined : open ? width : 15,
				height: stacked ? (open ? (size ?? settings.widgetUnitHeight) : 15) : undefined,
				fontSize: `${Math.min(1.12, Math.max(0.92, width / 220))}em`,
			}}
		>
			{open ? (
				<>
					<div
						className={`dashboard-sidebar-scroll flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto ${stacked ? 'overflow-x-auto' : ''}`}
					>
						{!stacked && <WeekStrip />}
						<WidgetDeck store={store} stacked={stacked} />
						{!stacked && <RecentDocs store={store} />}
					</div>
					<ResizeHandle
						label={t(stacked ? 'home.dashboard.resizeHeight' : 'home.dashboard.resizeWidth')}
						axis={stacked ? 'y' : 'x'}
						min={stacked ? 240 : 180}
						max={stacked ? 560 : 420}
						value={size ?? (stacked ? settings.widgetUnitHeight : settings.sidebarWidth)}
						className={
							stacked
								? 'absolute right-0 bottom-0 left-0 h-2 w-full cursor-ns-resize hover:bg-primary/20'
								: 'absolute top-0 right-0 bottom-0 h-full w-2 cursor-col-resize hover:bg-primary/20'
						}
						onPreview={setSize}
						onCommit={(value) => {
							void store.settings((s) => {
								if (stacked) s.widgetUnitHeight = value;
								else s.sidebarWidth = value;
							});
						}}
					/>
				</>
			) : (
				<Button
					variant="ghost"
					className={`h-full min-h-[15px] w-full p-0 ${stacked ? 'cursor-s-resize' : 'cursor-e-resize'}`}
					aria-label={t('home.dashboard.expandSidebar')}
					onPointerEnter={(event) => {
						if (event.pointerType === 'mouse') setExpanded(true);
					}}
					onClick={() => setExpanded(true)}
				>
					<span
						className={`rounded-full bg-[var(--db-text-faint)] opacity-50 ${stacked ? 'h-0.5 w-8' : 'h-8 w-0.5'}`}
					/>
				</Button>
			)}
		</aside>
	);
}
