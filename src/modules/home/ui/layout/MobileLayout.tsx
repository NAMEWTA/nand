// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/view.ts (renderMobileWidgetBar)
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { useState } from 'react';
import { useStore } from 'zustand';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import type { BoardStore } from '../../services/board-store';
import { Board } from '../board/Board';
import { WidgetDeck, enabledWidgets } from '../widgets/WidgetDeck';
export function MobileLayout({ store }: { store: BoardStore }) {
	const settings = useStore(store.state, (s) => s.settings),
		[active, setActive] = useState(''),
		t = useT();
	return (
		<div className="dashboard-main flex min-h-0 flex-1 flex-col gap-2.5 px-4 pt-2">
			<div className="flex shrink-0 gap-1 overflow-x-auto">
				{enabledWidgets(settings).map((id) => (
					<Button
						key={id}
						variant={active === id ? 'secondary' : 'ghost'}
						size="icon-xs"
						aria-label={t(`home.dashboard.widget.${id}`)}
						aria-expanded={active === id}
						onClick={() => setActive(active === id ? '' : id)}
					>
						<ObsidianIcon
							name={
								(
									{
										quickActions: 'zap',
										weather: 'cloud-sun',
										pomodoro: 'timer',
										countdown: 'hourglass',
										habit: 'check-circle',
										expense: 'wallet',
									} as Record<string, string>
								)[id] ?? 'box'
							}
						/>
					</Button>
				))}
			</div>
			{active && (
				<div className="max-h-[35vh] shrink-0 overflow-y-auto">
					<WidgetDeck store={store} only={active} mobile />
				</div>
			)}
			<Board store={store} mobile />
		</div>
	);
}
