import { Notice } from 'obsidian';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { habitFormatDate, type Habit } from '../../core/habit/model';
import type { HabitService } from '../../platform/habit/habit-service';
import { t } from '../../../../shared/i18n';
import { Icon } from '../../../../ui/primitives/Icon';
import { showConfirmDialog } from '../ui/confirm-dialog';
import { showPromptDialog } from '../ui/prompt-dialog';
import { wireCardTouchDrag } from './habit-drag';
/** `close` is omitted on the records page (a page has no close button). */
export function HabitStatsPanel({ service, close }: { service: HabitService; close?: () => void }) {
	const [, refresh] = useState(0),
		body = useRef<HTMLDivElement>(null),
		drag = useRef<number | null>(null);
	useLayoutEffect(() => service.subscribe(() => refresh((n) => n + 1)), [service]);
	const habits = service.getHabits();
	return (
		<>
			<div class="dashboard-habit-stats-header">
				<div class="dashboard-habit-stats-title">{t('habit.statsTitle')}</div>
				{close && (
					<button class="dashboard-habit-stats-close" aria-label={t('common.close')} onClick={close}>
						<Icon name="x" />
					</button>
				)}
			</div>
			<div ref={body} class="dashboard-habit-stats-body">
				{habits.length ? (
					habits.map((habit, index) => (
						<HabitStatCard
							key={habit.id}
							habit={habit}
							index={index}
							service={service}
							body={() => body.current}
							drag={drag}
						/>
					))
				) : (
					<div class="dashboard-habit-stats-empty">{t('habit.statsEmpty')}</div>
				)}
			</div>
		</>
	);
}
function HabitStatCard({
	habit,
	index,
	service,
	body,
	drag,
}: {
	habit: Habit;
	index: number;
	service: HabitService;
	body: () => HTMLElement | null;
	drag: { current: number | null };
}) {
	const card = useRef<HTMLDivElement>(null),
		[armed, setArmed] = useState(false),
		[over, setOver] = useState<'top' | 'bottom' | null>(null),
		[dragging, setDragging] = useState(false);
	useLayoutEffect(() => {
		const host = body(),
			element = card.current;
		if (host && element) return wireCardTouchDrag(host, element, index, service);
		return undefined;
	}, [index, service]);
	const half = (event: DragEvent) => {
		const rect = card.current!.getBoundingClientRect();
		return event.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
	};
	const series = service.getHeatmapDays(habit.id, 84),
		chips = [
			{ icon: 'flame', value: `${service.getStreak(habit.id)}${t('habit.dayUnit')}`, label: 'habit.streakLabel' },
			{ icon: 'percent', value: `${service.getRate30(habit.id)}%`, label: 'habit.rate30' },
			{ icon: 'check-circle-2', value: String(service.getTotal(habit.id)), label: 'habit.totalCount' },
		];
	return (
		<div
			ref={card}
			data-index={index}
			class={`dashboard-habit-stats-card${dragging ? ' dashboard-habit-stats-card--dragging' : ''}${over ? ` dashboard-habit-stats-card--drop-${over === 'top' ? 'before' : 'after'}` : ''}`}
			draggable={armed}
			onDragStart={(e) => {
				if (!armed) {
					e.preventDefault();
					return;
				}
				drag.current = index;
				setDragging(true);
				if (e.dataTransfer) {
					e.dataTransfer.effectAllowed = 'move';
					e.dataTransfer.setData('text/plain', 'habit-card');
				}
			}}
			onDragEnd={() => {
				drag.current = null;
				setDragging(false);
				setOver(null);
				setArmed(false);
			}}
			onDragOver={(e) => {
				if (drag.current === null || drag.current === index) return;
				e.preventDefault();
				setOver(half(e));
			}}
			onDragLeave={() => setOver(null)}
			onDrop={(e) => {
				e.preventDefault();
				const from = drag.current;
				drag.current = null;
				setOver(null);
				if (from !== null) {
					const to = half(e) === 'top' ? index : index + 1;
					if (from !== to) service.moveHabit(from, to);
				}
			}}
		>
			<div class="dashboard-habit-stats-card-head">
				<div
					class="dashboard-habit-stats-grip"
					aria-label={t('common.drag')}
					title={t('common.drag')}
					onPointerDown={() => setArmed(true)}
					onPointerUp={() => setArmed(false)}
				>
					<Icon name="grip-vertical" />
				</div>
				<div class="dashboard-habit-stats-card-name">{habit.name}</div>
				<div class="dashboard-habit-stats-card-head-spacer" />
				<div
					class="dashboard-habit-stats-icon-btn"
					role="button"
					aria-label={t('habit.renameTitle')}
					onClick={() =>
						void (async () => {
							const name = await showPromptDialog(service.getApp(), {
								title: t('habit.renameTitle'),
								defaultValue: habit.name,
							});
							if (name !== null && !service.renameHabit(habit.id, name)) new Notice(t('habit.duplicate'));
						})()
					}
				>
					<Icon name="pencil" />
				</div>
				<div
					class="dashboard-habit-stats-icon-btn"
					role="button"
					aria-label={t('habit.deleteTitle')}
					onClick={() =>
						void (async () => {
							if (
								await showConfirmDialog(service.getApp(), {
									title: t('habit.deleteTitle'),
									message: t('habit.deleteConfirm', { name: habit.name }),
								})
							)
								service.removeHabit(habit.id);
						})()
					}
				>
					<Icon name="trash-2" />
				</div>
			</div>
			<div class="dashboard-habit-stats-chips">
				{chips.map((chip) => (
					<div key={chip.icon} class="dashboard-habit-stats-chip">
						<Icon className="dashboard-habit-stats-chip-icon" name={chip.icon} />
						<div class="dashboard-habit-stats-chip-text">
							<div class="dashboard-habit-stats-chip-value">{chip.value}</div>
							<div class="dashboard-habit-stats-chip-label">{t(chip.label)}</div>
						</div>
					</div>
				))}
			</div>
			<div class="dashboard-habit-stats-heatmap-section">
				<div class="dashboard-habit-stats-heatmap-head">
					<div class="dashboard-habit-stats-heatmap-hint">{t('habit.heatmapHint')}</div>
				</div>
				<div class="dashboard-habit-stats-heatmap-wrap">
					<div class="dashboard-habit-stats-heatmap-grid">
						{series.map((done, i) => {
							const date = new Date();
							date.setDate(date.getDate() - (83 - i));
							return (
								<div
									key={i}
									class={`dashboard-habit-stats-heatmap-cell${done > 0 ? ' dashboard-habit-stats-heatmap-cell--done' : ''}`}
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
					<div class="dashboard-habit-stats-heatmap-empty">{t('habit.heatEmpty')}</div>
				)}
			</div>
		</div>
	);
}
