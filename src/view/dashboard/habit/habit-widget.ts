import { App, Notice } from 'obsidian';
import { h } from 'preact';
import { HABIT_MAX_NAME_LENGTH, habitToday } from '../../../core/habit/model';
import { getHabitService } from '../../../platform/obsidian/habit/habit-service';
import { t } from '../../../shared/i18n';
import { mountDashboardPanel } from '../renderer/render-context';
import { showPromptDialog } from '../ui/prompt-dialog';
import { appendInlineBackgroundButton, applyWidgetBackground } from '../widgets/widget-background';
import { HabitBackfillModal } from './habit-backfill-modal';
import { showHabitStats } from './habit-stats-modal';
import { HabitPanel } from './HabitPanel';
const refreshers = new WeakMap<HTMLElement, () => void>();

/** Native actions are supplied to a independently composable business panel. */
export function renderSidebarHabitWidget(
	container: HTMLElement,
	app: App,
	bg?: import('../../../core/dashboard/types').WidgetBackground,
	onBgChange?: (bg: import('../../../core/dashboard/types').WidgetBackground | undefined) => void,
): void {
	const service = getHabitService(app);
	if (!service) return;
	const widget = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-habit' });
	const backgroundSlot = onBgChange
		? h('span', {
				ref: (element: HTMLSpanElement | null) => {
					if (element && !element.firstChild) appendInlineBackgroundButton(element, app, bg, onBgChange);
				},
			})
		: undefined;
	const add = async () => {
		const name = await showPromptDialog(app, { title: t('habit.newTitle') });
		if (name === null) return;
		if (!service.addHabit(name))
			new Notice(
				name.trim().length === 0 || name.trim().length > HABIT_MAX_NAME_LENGTH
					? t('habit.tooLong')
					: t('habit.duplicate'),
			);
	};
	const refresh = () =>
		mountDashboardPanel(
			widget,
			h(HabitPanel, {
				rows: service.getHabits().map((habit) => ({
					id: habit.id,
					name: habit.name,
					done: service.isDone(habit.id, habitToday()),
					streak: service.getStreak(habit.id),
				})),
				toggle: (id: string) => {
					service.toggle(id);
				},
				add: () => {
					void add();
				},
				backfill: () => {
					new HabitBackfillModal(app).open();
				},
				statistics: () => showHabitStats(widget.ownerDocument, service),
				backgroundSlot,
			}),
		);
	refreshers.set(widget, refresh);
	refresh();
	// Preact's first render drops DOM that existed before it. The photo layer
	// has to be applied after the panel owns the card.
	applyWidgetBackground(widget, bg, app);
}
export function refreshHabitWidget(root: HTMLElement): void {
	root.querySelectorAll<HTMLElement>('.dashboard-sidebar-habit').forEach((widget) => {
		if (widget.isConnected) refreshers.get(widget)?.();
	});
}
