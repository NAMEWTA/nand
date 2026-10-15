// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/habit-stats-modal.ts
import { useEffect, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import {
	SortableContext,
	useSortable,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { habitFormatDate, type Habit } from '../../core/habit/model';
import type { HabitService } from '../../platform/habit/habit-service';
import { t } from '../../../../shared/i18n';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
import { RecordButton as Button } from '../dialogs/RecordButton';
import { Input } from '../../../../ui/components/input';
import { RecordConfirm as ConfirmDialog } from '../dialogs/RecordConfirm';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { RecordSaveStatus } from '../dialogs/RecordSaveStatus';
import { widgetClasses } from '../theme/widget-classes';
export function HabitStatsPanel({ service, close }: { service: HabitService; close?: () => void }) {
	const [, refresh] = useState(0);
	useEffect(() => service.subscribe(() => refresh((n) => n + 1)), [service]);
	const habits = service.getHabits();
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	return (
		<>
			<RecordSaveStatus source={service} />
			<div className={widgetClasses('dashboard-habit-stats-header')}>
				<div className={widgetClasses('dashboard-habit-stats-title')}>{t('habit.statsTitle')}</div>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-habit-stats-close')}
					aria-label={t('common.close')}
					onClick={close}
				>
					<Icon name="x" />
				</Button>
			</div>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={({ active, over }) => {
					if (!over || active.id === over.id) return;
					const from = habits.findIndex((h) => h.id === active.id),
						to = habits.findIndex((h) => h.id === over.id);
					if (from >= 0 && to >= 0) service.moveHabit(from, to > from ? to + 1 : to);
				}}
			>
				<SortableContext items={habits.map((h) => h.id)} strategy={verticalListSortingStrategy}>
					<div className={widgetClasses('dashboard-habit-stats-body')}>
						{habits.length ? (
							habits.map((habit) => <HabitStatCard key={habit.id} habit={habit} service={service} />)
						) : (
							<div className={widgetClasses('dashboard-habit-stats-empty')}>{t('habit.statsEmpty')}</div>
						)}
					</div>
				</SortableContext>
			</DndContext>
		</>
	);
}
function HabitStatCard({ habit, service }: { habit: Habit; service: HabitService }) {
	const { setNodeRef, attributes, listeners, transform, isDragging } = useSortable({ id: habit.id });
	const [rename, setRename] = useState(false),
		[remove, setRemove] = useState(false),
		[name, setName] = useState(habit.name),
		[error, setError] = useState(false);
	const series = service.getHeatmapDays(habit.id, 84),
		chips = [
			{ icon: 'flame', value: `${service.getStreak(habit.id)}${t('habit.dayUnit')}`, label: 'habit.streakLabel' },
			{ icon: 'percent', value: `${service.getRate30(habit.id)}%`, label: 'habit.rate30' },
			{ icon: 'check-circle-2', value: String(service.getTotal(habit.id)), label: 'habit.totalCount' },
		];

	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.4 : undefined }}
			className={widgetClasses('dashboard-habit-stats-card')}
		>
			<div className={widgetClasses('dashboard-habit-stats-card-head')}>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-habit-stats-grip')}
					aria-label={t('home.dashboard.drag')}
					{...attributes}
					{...listeners}
				>
					<Icon name="grip-vertical" />
				</Button>
				<div className={widgetClasses('dashboard-habit-stats-card-name')}>{habit.name}</div>
				<div className={widgetClasses('dashboard-habit-stats-card-head-spacer')} />
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-habit-stats-icon-btn')}
					aria-label={t('habit.renameTitle')}
					onClick={() => setRename(true)}
				>
					<Icon name="pencil" />
				</Button>
				<Button
					variant="ghost"
					className={widgetClasses('dashboard-habit-stats-icon-btn')}
					aria-label={t('habit.deleteTitle')}
					onClick={() => setRemove(true)}
				>
					<Icon name="trash-2" />
				</Button>
			</div>
			<div className={widgetClasses('dashboard-habit-stats-chips')}>
				{chips.map((chip) => (
					<div key={chip.icon} className={widgetClasses('dashboard-habit-stats-chip')}>
						<Icon className={widgetClasses('dashboard-habit-stats-chip-icon')} name={chip.icon} />
						<div className={widgetClasses('dashboard-habit-stats-chip-text')}>
							<div className={widgetClasses('dashboard-habit-stats-chip-value')}>{chip.value}</div>
							<div className={widgetClasses('dashboard-habit-stats-chip-label')}>{t(chip.label)}</div>
						</div>
					</div>
				))}
			</div>
			<div className={widgetClasses('dashboard-habit-stats-heatmap-section')}>
				<div className={widgetClasses('dashboard-habit-stats-heatmap-head')}>
					<div className={widgetClasses('dashboard-habit-stats-heatmap-hint')}>{t('habit.heatmapHint')}</div>
				</div>
				<div className={widgetClasses('dashboard-habit-stats-heatmap-wrap')}>
					<div className={widgetClasses('dashboard-habit-stats-heatmap-grid')}>
						{series.map((done, i) => {
							const date = new Date();
							date.setDate(date.getDate() - (83 - i));
							return (
								<div
									key={i}
									className={widgetClasses(
										`dashboard-habit-stats-heatmap-cell${done > 0 ? ' dashboard-habit-stats-heatmap-cell--done' : ''}`,
									)}
									title={
										done > 0
											? `${habitFormatDate(date)} · ${t('habit.heatDone')}`
											: habitFormatDate(date)
									}
								/>
							);
						})}
					</div>
				</div>
				{series.every((value) => value === 0) && (
					<div className={widgetClasses('dashboard-habit-stats-heatmap-empty')}>{t('habit.heatEmpty')}</div>
				)}
			</div>
			{rename && (
				<DashboardDialog
					title={t('habit.renameTitle')}
					onClose={() => setRename(false)}
					onSave={() => {
						const ok = service.renameHabit(habit.id, name);
						setError(!ok);
						if (ok) setRename(false);
					}}
				>
					<Input aria-label={t('habit.renameTitle')} value={name} onChange={(e) => setName(e.target.value)} />
					{error && <p role="alert">{t('habit.duplicate')}</p>}
				</DashboardDialog>
			)}
			<ConfirmDialog
				open={remove}
				onOpenChange={setRemove}
				title={t('habit.deleteTitle')}
				description={t('habit.deleteConfirm', { name: habit.name })}
				onConfirm={() => service.removeHabit(habit.id)}
			/>
		</div>
	);
}
