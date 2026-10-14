// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/habit-widget.ts
import { lazy, Suspense, useState } from 'react';
import { useStore } from 'zustand';
import { Plus, History, Flame, Target } from 'lucide-react';
import { Checkbox } from '../../../../ui/components/checkbox';
import { Input } from '../../../../ui/components/input';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import { todayStr } from '../../core/habit/model';
import { IconButton } from '../board/controls';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { RecordDialog } from '../dialogs/RecordDialog';
import { BarChart2 } from 'lucide-react';
const Stats = lazy(() => import('../habit/HabitStatsPanel').then((m) => ({ default: m.HabitStatsPanel })));
export function HabitWidget({ store }: { store: BoardStore }) {
	useStore(store.state, (s) => s.widgetRevision);
	const [stats, setStats] = useState(false);
	const t = useT(),
		service = store.widgets.habit,
		[adding, setAdding] = useState(false),
		[backfill, setBackfill] = useState(false),
		[name, setName] = useState('');
	if (!service) return null;
	const habits = service.getHabits(),
		yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	const key = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
	return (
		<>
			{stats && (
				<RecordDialog
					title={t('habit.statsTitle')}
					classes="dashboard-habit-stats-modal"
					onClose={() => setStats(false)}
				>
					<Suspense fallback={null}>
						<Stats service={service} close={() => setStats(false)} />
					</Suspense>
				</RecordDialog>
			)}
			<div className="mb-1.5 flex h-5 items-center gap-1.5">
				<h3 className="m-0 flex min-w-0 items-center gap-1 text-[.7em] font-semibold tracking-[.08em] text-primary">
					<Target className="size-3" />
					{t('habit.title')}
				</h3>
				<span className="text-[.65em] text-muted-foreground">
					{habits.length ? `${service.getDoneOn(todayStr()).length}/${habits.length}` : ''}
				</span>
				<div className="ml-auto flex">
					<IconButton className="size-5" label={t('habit.statsTitle')} onClick={() => setStats(true)}>
						<BarChart2 className="size-3" />
					</IconButton>
					<IconButton
						className="size-5"
						label={t('home.dashboard.yesterday')}
						onClick={() => setBackfill(true)}
					>
						<History className="size-3" />
					</IconButton>
					<IconButton className="size-5" label={t('common.add')} onClick={() => setAdding(true)}>
						<Plus className="size-3" />
					</IconButton>
				</div>
			</div>
			<div className="grid gap-0.5">
				{!habits.length && (
					<p className="m-0 py-2 text-center text-[.68em] text-muted-foreground opacity-70">
						{t('habit.emptyHint')}
					</p>
				)}
				{habits.map((habit) => (
					<label key={habit.id} className="flex items-center gap-2 rounded-md px-[5px] py-1 text-[.75em]">
						<Checkbox
							className="rounded-full"
							checked={service.isDone(habit.id)}
							onCheckedChange={() => service.toggle(habit.id)}
						/>
						<span className="flex-1">{habit.name}</span>
						<span className="flex items-center text-[.8em] text-muted-foreground">
							<Flame className="size-3" />
							{service.getStreak(habit.id)}
						</span>
					</label>
				))}
			</div>
			{adding && (
				<DashboardDialog
					title={t('home.dashboard.widget.habit')}
					onClose={() => setAdding(false)}
					onSave={() => {
						if (service.addHabit(name)) {
							setName('');
							setAdding(false);
						}
					}}
				>
					<Input
						aria-label={t('home.dashboard.name')}
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
				</DashboardDialog>
			)}
			{backfill && (
				<DashboardDialog title={t('home.dashboard.yesterday')} onClose={() => setBackfill(false)}>
					{habits.map((habit) => (
						<label key={habit.id} className="flex gap-2">
							<Checkbox
								checked={service.isDone(habit.id, key)}
								onCheckedChange={() => service.toggle(habit.id, key)}
							/>
							{habit.name}
						</label>
					))}
				</DashboardDialog>
			)}
		</>
	);
}
