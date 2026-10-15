import { useWidgetBackground } from './WidgetBackground';
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
import { ReadingWidget } from './ReadingWidget';
import { LunarWidget } from './LunarWidget';
import { YearProgressWidget } from './YearProgressWidget';
import { CalendarWidget } from './CalendarWidget';
import { AnniversaryWidget } from './AnniversaryWidget';
import { widgetClasses } from '../theme/widget-classes';
import { inputWidgetClasses } from '../theme/input-widget-classes';
import { QuickCaptureWidget, FileSearchWidget } from './InputWidgets';
import { SkillWidget } from './SkillWidget';
export const WIDGETS: Record<
	string,
	{
		enabled: keyof DashboardSettings;
		component: ComponentType<{ store: BoardStore; compact?: boolean; entryId?: string }>;
	}
> = {
	quickCapture: { enabled: 'widgetQuickCaptureEnabled', component: QuickCaptureWidget },
	fileSearch: { enabled: 'widgetFileSearchEnabled', component: FileSearchWidget },
	skills: { enabled: 'widgetSkillsEnabled', component: SkillWidget },
	reading: { enabled: 'readingEnabled', component: ReadingWidget },
	lunar: { enabled: 'widgetLunarEnabled', component: LunarWidget },
	yearProgress: { enabled: 'widgetYearProgressEnabled', component: YearProgressWidget },
	calendar: { enabled: 'widgetCalendarEnabled', component: CalendarWidget },
	anniversary: { enabled: 'anniversaryEnabled', component: AnniversaryWidget },
	quickActions: { enabled: 'widgetQuickActionsEnabled', component: QuickActionsWidget },
	weather: { enabled: 'widgetWeatherEnabled', component: WeatherWidget },
	pomodoro: { enabled: 'pomodoroEnabled', component: PomodoroWidget },
	countdown: { enabled: 'countdownEnabled', component: CountdownWidget },
	habit: { enabled: 'widgetHabitEnabled', component: HabitWidget },
	expense: { enabled: 'widgetExpenseEnabled', component: ExpenseWidget },
};
export function widgetKind(id: string): string {
	return id.startsWith('anniversary-') ? 'anniversary' : id.startsWith('countdown-') ? 'countdown' : id;
}
export function enabledWidgets(settings: DashboardSettings): string[] {
	const candidates = [...settings.widgetOrder, ...Object.keys(WIDGETS)].flatMap((id) =>
		id === 'anniversary' && settings.anniversaries.length
			? settings.anniversaries.map((c) => `anniversary-${c.id}`)
			: [id],
	);
	return [...new Set(candidates)].filter((id) => {
		const kind = widgetKind(id);
		return (
			WIDGETS[kind] &&
			settings[WIDGETS[kind].enabled] &&
			(!id.startsWith('anniversary-') || settings.anniversaries.some((c) => id === `anniversary-${c.id}`))
		);
	});
}
function WidgetFrame({ store, id, mobile, span }: { store: BoardStore; id: string; mobile?: boolean; span?: number }) {
	const multiSkills = useStore(
		store.state,
		(s) => s.settings.skillWidgetButtons.filter((skill) => skill.label.trim()).length > 4,
	);
	const background = useWidgetBackground(store, widgetKind(id));
	const t = useT(),
		{ attributes, isDragging, listeners, setNodeRef, transform } = useSortable({
			id: `widget:${id}`,
			data: { item: { kind: 'widget', id } },
			disabled: mobile,
		}),
		kind = widgetKind(id),
		Component = WIDGETS[kind]!.component;
	return (
		<section
			data-widget={id}
			ref={setNodeRef}
			{...attributes}
			aria-label={t(`home.dashboard.widget.${kind}`)}
			onKeyDown={(event) => {
				if (event.target === event.currentTarget) listeners?.onKeyDown?.(event);
			}}
			onPointerDown={(event) => {
				if (!(event.target as Element).closest('button,input,textarea,select,a,[role="checkbox"]'))
					listeners?.onPointerDown?.(event);
			}}
			className={inputWidgetClasses(
				widgetClasses(
					`dashboard-sidebar-widget ${background.className} group/widget min-w-0 shrink-0 rounded-[var(--db-radius-md)] border border-[var(--db-border-card)] bg-card ${id === 'quickActions' ? 'dashboard-quick-actions' : ''} ${id === 'pomodoro' ? 'dashboard-sidebar-pomodoro' : ''} ${id === 'expense' ? 'dashboard-sidebar-expense' : ''} ${id === 'reading' ? 'dashboard-sidebar-reading' : ''} ${id === 'lunar' ? 'dashboard-sidebar-lunar' : ''} ${id === 'yearProgress' ? 'dashboard-sidebar-year-progress' : ''} ${id === 'calendar' ? 'dashboard-sidebar-calendar' : ''} ${id === 'quickCapture' || id === 'fileSearch' ? 'dashboard-sidebar-capturebar' : ''} ${id === 'fileSearch' ? 'dashboard-sidebar-filesearch' : ''} ${id === 'skills' ? `dashboard-sidebar-skills ${multiSkills ? 'dashboard-sidebar-skills--multi' : ''}` : ''}`,
				),
			)}
			style={{
				...background.style,
				transform: CSS.Transform.toString(transform),
				gridRow: span ? `span ${span}` : undefined,
				opacity: isDragging ? 0.4 : undefined,
			}}
		>
			{background.layer}
			{![
				'pomodoro',
				'quickActions',
				'habit',
				'expense',
				'reading',
				'lunar',
				'yearProgress',
				'calendar',
				'anniversary',
				'quickCapture',
				'fileSearch',
				'skills',
			].includes(kind) && (
				<div className="mb-2 flex items-center gap-1">
					<h3 className="m-0 flex-1 text-[.8em] font-semibold">{t(`home.dashboard.widget.${kind}`)}</h3>
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
			<Component
				store={store}
				compact={!!span}
				entryId={id.startsWith('anniversary-') ? id.slice('anniversary-'.length) : undefined}
			/>
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
			{ habit: settings.habitHeightRatio, reading: settings.readingHeightRatio },
		),
	);
	return (
		<SortableContext
			items={ids.map((id) => `widget:${id}`)}
			strategy={stacked ? rectSortingStrategy : verticalListSortingStrategy}
		>
			<div
				className={widgetClasses(
					`dashboard-sidebar-widgets min-h-0 gap-1.5 px-1 ${stacked ? 'grid h-full grid-flow-col auto-cols-[240px] grid-rows-6' : 'flex shrink-0 flex-col'}`,
				)}
			>
				{ids.map((id, i) => (
					<WidgetFrame key={id} store={store} id={id} mobile={mobile} span={stacked ? spans[i] : undefined} />
				))}
			</div>
		</SortableContext>
	);
}
