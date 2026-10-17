// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/view.ts
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'obsidian';
import { useStore } from 'zustand';
import type { NativeSurfaceContext } from '../../../ui/native-surface';
import { useOwnerDocument, useVisible } from '../../../ui/react/contexts';
import { useT } from '../../../ui/react/hooks';
import type { BoardStore } from '../services/board-store';
import { ThemeBridge } from './theme/ThemeBridge';
import { BoardCanvas } from './canvas/BoardCanvas';
import { ReadingMini } from './widgets/ReadingMini';
import { PomodoroMini } from './widgets/PomodoroMini';
import { BoardDnd } from './board/dnd';
import { NotePreview } from './dialogs/NotePreview';
/** The board page: one widget canvas. At 600px and below the same canvas projects to a single column. */
export function DashboardPage({ store, context }: { store: BoardStore; context: NativeSurfaceContext }) {
	const data = useStore(store.state, (s) => s.data),
		generation = useStore(store.state, (s) => s.generation),
		doc = useOwnerDocument(),
		visible = useVisible(),
		ref = useRef<HTMLDivElement>(null),
		[narrow, setNarrow] = useState(false),
		t = useT();
	useEffect(() => {
		const el = ref.current,
			win = doc.defaultView;
		if (!el || !win) return;
		const observer = new win.ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width;
			if (width) setNarrow(width <= 600);
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, [doc]);
	useEffect(() => {
		store.setVisible(visible);
		if (!visible) store.setDialog(null);
	}, [visible, store]);
	const mobile = Platform.isPhone || narrow;
	return (
		<div ref={ref} className="h-full min-h-0" aria-label={t('workbench.home')}>
			{data ? (
				// One generation per board shown: switching replaces the whole tree and hands it a store view of that generation.
				<ThemeBridge key={generation} store={store.view(generation)} layout={mobile ? 'mobile' : 'canvas'}>
					<BoardDnd store={store.view(generation)}>
						<BoardCanvas store={store} context={context} mobile={mobile} />
					</BoardDnd>
					<PomodoroMini store={store.view(generation)} />
					<ReadingMini store={store.view(generation)} />
					<NotePreview store={store.view(generation)} />
				</ThemeBridge>
			) : (
				<div role="status">{t('home.dashboard.loading')}</div>
			)}
		</div>
	);
}
