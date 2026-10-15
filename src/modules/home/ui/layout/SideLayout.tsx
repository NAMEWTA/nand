// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/view.ts
import type { BoardStore } from '../../services/board-store';
import { Board } from '../board/Board';
import { Sidebar } from '../sidebar/Sidebar';
export function SideLayout({ store }: { store: BoardStore }) {
	return (
		<div className="dashboard-main flex min-h-0 flex-1 gap-2.5 overflow-hidden px-4 pt-2">
			<Sidebar store={store} />
			<Board store={store} mobile={false} />
		</div>
	);
}
