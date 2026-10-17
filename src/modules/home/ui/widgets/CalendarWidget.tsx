// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/calendar-widget.ts
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { BoardStore } from '../../services/board-store';
import { useOwnerDocument, useVisible } from '../../../../ui/react/contexts';
import { DashboardRenderContext } from '../renderer/render-context';
import { CalendarPanel } from '../calendar/CalendarPanel';
import { CalendarMonthModal, DayAgendaModal } from '../calendar/calendar-modal';
import { widgetClasses } from '../theme/widget-classes';
import { useBox } from './use-box';

/** The month grid needs this much height; a shorter tile starts in the week view. */
const MONTH_MIN_HEIGHT = 440;
export function CalendarWidget({ store, section = false }: { store: BoardStore; section?: boolean }) {
	const settings = useStore(store.state, (s) => s.settings),
		doc = useOwnerDocument(),
		visible = useVisible();
	const [boxRef, box] = useBox<HTMLDivElement>(),
		viewHint = box.height === 0 ? undefined : box.height < MONTH_MIN_HEIGHT ? 'week' : 'month';
	const [context] = useState(() => new DashboardRenderContext(doc.createElement('div'))),
		[root, setRoot] = useState<HTMLDivElement | null>(null),
		dialog = useRef<{ close(): void } | null>(null);
	useEffect(() => () => dialog.current?.close(), []);
	useEffect(() => {
		if (!visible) dialog.current?.close();
	}, [visible]);
	const access = {
		getSettings: () => store.state.getState().settings,
		updateSettings: async (update: (s: typeof settings) => typeof settings) => {
			await store.settings((s) => Object.assign(s, update(s)));
			return true;
		},
	};
	const openNote = (file: { path: string }) => {
		void store.openFile(file.path);
	};
	return (
		<div ref={boxRef} className={section ? undefined : 'h-full min-h-0'}>
			<div
				ref={setRoot}
				className={widgetClasses(section ? 'dashboard-calendar-section' : 'dashboard-calendar-content')}
			>
				{root && (
					<CalendarPanel
						root={root}
						context={context}
						app={store.host.app}
						settings={settings}
						settingsAccess={access}
						widget={!section}
						viewHint={section ? undefined : viewHint}
						onOpenNote={openNote}
						openDay={(iso, tasks, focus, onToggle) => {
							dialog.current?.close();
							const next = new DayAgendaModal(
								store.host.app,
								iso,
								tasks,
								{ onToggle, onOpenNote: openNote, settingsAccess: access },
								settings.dashboardFile,
								focus,
								doc,
							);
							dialog.current = next;
							next.open();
						}}
						openFull={(byDay, view, week, onToggle) => {
							dialog.current?.close();
							const next = new CalendarMonthModal(
								store.host.app,
								byDay,
								{ onToggle, onOpenNote: openNote, settingsAccess: access },
								view,
								week,
								settings.dashboardFile,
								doc,
							);
							dialog.current = next;
							next.open();
						}}
					/>
				)}
			</div>
		</div>
	);
}
