// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts (renderSidebarWidgets)
import type { ComponentType } from 'react';
import { useStore } from 'zustand';
import { SortableContext, useSortable, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable';
import { buildStackedSpanSpecs, resolveStackedSpans } from '../../core/board/widget-span';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { BoardStore } from '../../services/board-store';
import type { DashboardSettings } from '../../core/board/types/model';
import { useT } from '../../../../ui/react/hooks';
import { IconButton } from '../board/controls';
import { QuickActionsWidget } from './QuickActionsWidget';
import { WeatherWidget } from './WeatherWidget';
import { PomodoroWidget } from './PomodoroWidget';
import { HabitWidget } from './HabitWidget';
import { ExpenseWidget } from './ExpenseWidget';
import { CountdownWidget } from './CountdownWidget';
export const WIDGETS: Record<
	string,
	{ enabled: keyof DashboardSettings; component: ComponentType<{ store: BoardStore; compact?: boolean }> }
> = {
	quickActions: { enabled: 'widgetQuickActionsEnabled', component: QuickActionsWidget },
	weather: { enabled: 'widgetWeatherEnabled', component: WeatherWidget },
	pomodoro: { enabled: 'pomodoroEnabled', component: PomodoroWidget },
	countdown: { enabled: 'countdownEnabled', component: CountdownWidget },
	habit: { enabled: 'widgetHabitEnabled', component: HabitWidget },
	expense: { enabled: 'widgetExpenseEnabled', component: ExpenseWidget },
};
export function enabledWidgets(settings: DashboardSettings): string[] {
	return [...new Set([...settings.widgetOrder, ...Object.keys(WIDGETS)])].filter(
		(id) => WIDGETS[id] && settings[WIDGETS[id].enabled],
	);
}
function WidgetFrame({ store, id, mobile, span }: { store: BoardStore; id: string; mobile?: boolean; span?: number }) {
	const t = useT(),
		{ attributes, isDragging, listeners, setNodeRef, transform } = useSortable({
			id: `widget:${id}`,
			data: { item: { kind: 'widget', id } },
			disabled: mobile,
		}),
		Component = WIDGETS[id]!.component;
	return (
		<section
			data-widget={id}
			ref={setNodeRef}
			{...attributes}
			aria-label={t(`home.dashboard.widget.${id}`)}
			onKeyDown={(event) => {
				if (event.target === event.currentTarget) listeners?.onKeyDown?.(event);
			}}
			onPointerDown={(event) => {
				if (!(event.target as Element).closest('button,input,textarea,select,a,[role="checkbox"]'))
					listeners?.onPointerDown?.(event);
			}}
			className={`dashboard-sidebar-widget group/widget min-w-0 shrink-0 rounded-[var(--db-radius-md)] border border-[var(--db-border-card)] bg-card ${id === 'quickActions' ? 'dashboard-quick-actions' : ''} ${id === 'pomodoro' ? 'dashboard-sidebar-pomodoro' : ''} ${id === 'expense' ? 'dashboard-sidebar-expense' : ''}`}
			style={{
				transform: CSS.Transform.toString(transform),
				gridRow: span ? `span ${span}` : undefined,
				opacity: isDragging ? 0.4 : undefined,
			}}
		>
			{!['pomodoro', 'quickActions', 'habit', 'expense'].includes(id) && (
				<div className="mb-2 flex items-center gap-1">
					<h3 className="m-0 flex-1 text-[.8em] font-semibold">{t(`home.dashboard.widget.${id}`)}</h3>
					{!mobile && (
						<IconButton
							label={t('home.dashboard.drag')}
							className="size-4 opacity-0 group-hover/widget:opacity-100 focus-visible:opacity-100"
							{...attributes}
							{...listeners}
						>
							<GripVertical className="size-3" />
						</IconButton>
					)}
				</div>
			)}
			<Component store={store} compact={!!span} />
		</section>
	);
}
export function WidgetDeck({
	store,
	only,
	mobile,
	stacked = false,
}: {
	store: BoardStore;
	only?: string;
	mobile?: boolean;
	stacked?: boolean;
}) {
	const settings = useStore(store.state, (s) => s.settings),
		ids = only ? [only] : enabledWidgets(settings);
	const spans = resolveStackedSpans(
		buildStackedSpanSpecs(
			ids.map((id) => (id === 'countdown' ? 'countdown-all' : id)),
			{ habit: settings.habitHeightRatio },
		),
	);
	return (
		<SortableContext
			items={ids.map((id) => `widget:${id}`)}
			strategy={stacked ? rectSortingStrategy : verticalListSortingStrategy}
		>
			<div
				className={`dashboard-sidebar-widgets min-h-0 gap-1.5 px-1 ${stacked ? 'grid h-full grid-flow-col auto-cols-[240px] grid-rows-6' : 'flex shrink-0 flex-col'}`}
			>
				{ids.map((id, i) => (
					<WidgetFrame key={id} store={store} id={id} mobile={mobile} span={stacked ? spans[i] : undefined} />
				))}
			</div>
		</SortableContext>
	);
}
