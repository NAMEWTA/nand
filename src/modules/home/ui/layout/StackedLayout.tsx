// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/view.ts
import { useStore } from 'zustand';
import type { BoardStore } from '../../services/board-store';
import { enabledWidgets } from '../widgets/WidgetDeck';
import { Board } from '../board/Board';
import { Sidebar } from '../sidebar/Sidebar';
import { QuickNotesBar } from '../quickbar/QuickNotesBar';
export function StackedLayout({ store }: { store: BoardStore }) {
	const settings = useStore(store.state, (s) => s.settings),
		quickbar = settings.quickNotesEnabled;
	return (
		<div className="dashboard-main flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-4 pt-2">
			{quickbar && (
				<div className="shrink-0">
					<QuickNotesBar store={store} />
				</div>
			)}
			<div
				className={`dashboard-stacked-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto [scrollbar-width:thin] ${enabledWidgets(settings).length ? '' : 'pt-2.5'}`}
			>
				<Sidebar store={store} stacked />
				<Board store={store} mobile={false} quickbar={false} scrolling={false} />
			</div>
		</div>
	);
}
