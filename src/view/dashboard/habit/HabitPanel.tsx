import { t } from '../../../shared/i18n';
import { Icon } from '../../primitives/Icon';
export interface HabitRow {
	id: string;
	name: string;
	done: boolean;
	streak: number;
}
export interface HabitPanelProps {
	rows: HabitRow[];
	toggle: (id: string) => void;
	add: () => void;
	backfill: () => void;
	statistics: () => void;
	backgroundSlot?: import('preact').ComponentChildren;
}
export function HabitPanel({ rows, toggle, add, backfill, statistics, backgroundSlot }: HabitPanelProps) {
	const done = rows.filter((row) => row.done).length;
	return (
		<>
			<div class="dashboard-sidebar-habit-top">
				<div class="dashboard-sidebar-habit-title">
					<div class="dashboard-sidebar-habit-title-icon">
						<Icon name="target" />
					</div>
					<span class="dashboard-sidebar-habit-title-text">{t('habit.title')}</span>
				</div>
				<div class="dashboard-sidebar-habit-count">{done > 0 ? `${done}/${rows.length}` : ''}</div>
				<div class="dashboard-sidebar-habit-top-spacer" />
				{[
					{ label: 'habit.backfillTitle', icon: 'history', action: backfill },
					{ label: 'habit.newTitle', icon: 'plus', action: add },
					{ label: 'habit.statsTitle', icon: 'bar-chart-2', action: statistics },
				].map((item) => (
					<div
						key={item.label}
						class="dashboard-sidebar-habit-icon-btn"
						role="button"
						tabIndex={0}
						aria-label={t(item.label)}
						onClick={(e) => {
							e.stopPropagation();
							item.action();
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								item.action();
							}
						}}
					>
						<Icon name={item.icon} />
					</div>
				))}
				{backgroundSlot}
			</div>
			<div class="dashboard-sidebar-habit-list">
				{rows.length === 0 ? (
					<div class="dashboard-sidebar-habit-empty">{t('habit.emptyHint')}</div>
				) : (
					rows.map((row) => (
						<div
							key={row.id}
							data-habit-id={row.id}
							class={`dashboard-sidebar-habit-item${row.done ? ' dashboard-sidebar-habit-item--done' : ''}`}
							role="checkbox"
							aria-checked={row.done}
							tabIndex={0}
							onClick={() => toggle(row.id)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									toggle(row.id);
								}
							}}
						>
							<div
								class={`dashboard-sidebar-habit-check${row.done ? ' dashboard-sidebar-habit-check--done' : ''}`}
							>
								{row.done && <Icon name="check" />}
							</div>
							<div class="dashboard-sidebar-habit-name">{row.name}</div>
							{row.streak > 0 && (
								<div class="dashboard-sidebar-habit-streak">
									{row.streak}
									{t('habit.dayUnit')}
								</div>
							)}
						</div>
					))
				)}
			</div>
		</>
	);
}
