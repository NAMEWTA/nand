// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/view.ts
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'obsidian';
import { useStore } from 'zustand';
import type { NativeSurfaceContext } from '../../../ui/native-surface';
import { useOwnerDocument, useVisible } from '../../../ui/react/contexts';
import { useT } from '../../../ui/react/hooks';
import type { BoardStore } from '../services/board-store';
import { ThemeBridge } from './theme/ThemeBridge';
import { Banner } from './banner/Banner';
import { SideLayout } from './layout/SideLayout';
import { StackedLayout } from './layout/StackedLayout';
import { MobileLayout } from './layout/MobileLayout';
import { ReadingMini } from './widgets/ReadingMini';
import { PomodoroMini } from './widgets/PomodoroMini';
import { BoardDnd } from './board/dnd';
import { NotePreview } from './dialogs/NotePreview';
export function DashboardPage({ store, context }: { store: BoardStore; context: NativeSurfaceContext }) {
	const data = useStore(store.state, (s) => s.data),
		settings = useStore(store.state, (s) => s.settings),
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
	const mobile = Platform.isPhone || narrow,
		layout = mobile
			? 'mobile'
			: data?.layout === 'stacked' || (!data?.layout && settings.layoutMode === 'stacked')
				? 'stacked'
				: 'side';
	return (
		<div ref={ref} className="h-full min-h-0" aria-label={t('workbench.home')}>
			{data ? (
				<ThemeBridge store={store} layout={layout}>
					<BoardDnd store={store}>
						<Banner store={store} context={context} mobile={mobile} />
						{mobile ? (
							<MobileLayout store={store} />
						) : layout === 'stacked' ? (
							<StackedLayout store={store} />
						) : (
							<SideLayout store={store} />
						)}
					</BoardDnd>
					<PomodoroMini store={store} />
					<ReadingMini store={store} />
					<NotePreview store={store} />
				</ThemeBridge>
			) : (
				<div role="status">{t('home.dashboard.loading')}</div>
			)}
		</div>
	);
}
