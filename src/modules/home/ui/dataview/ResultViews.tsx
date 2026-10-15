// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/dataview-section.ts
import { p1Classes } from '../theme/p1-classes';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
import { Fragment } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { DataviewConfig } from '../../core/board/types';
import type { DqlValue, QueryResult, ResultRow } from '../../core/dql/types';
import { coerceNumber, formatValue, kindOf } from '../../core/dql/values';
import { toggleTaskInFile } from '../../platform/calendar/alltasks-scan';
import { invalidatePath } from '../../platform/dql/page-builder';
import { t } from '../../../../shared/i18n';
import { ObsidianIcon as Icon } from '../../../../ui/components/nand/ObsidianIcon';
import type { DataviewContext } from './context';
import {
	buildDataviewWeekColumns,
	dayKey,
	fillYearHeatmapData,
	monthLabel,
	monthStart,
	rowDateTs,
	shiftMonth,
} from './date-layout';
import { displayColumns, nextSortState, sourceInfoOf, tableLayout, type ViewState } from './table-model';
import { chooseDataviewCellSize, computeDataviewMonthLabels, ymdKey } from './value-model';
import { InlineValue, Value, rowOpen } from './Values';
export function EmptyResult({ message, hint }: { message: string; hint?: boolean | string }) {
	return (
		<div className={p1Classes('dashboard-dataview-empty')}>
			<div className={p1Classes('dashboard-dataview-empty-icon')} />
			<div className={p1Classes('dashboard-dataview-empty-text')}>{t(message)}</div>
			{hint && (
				<div className={p1Classes('dashboard-dataview-empty-hint')}>
					{t(typeof hint === 'string' ? hint : 'dataview.configureHint')}
				</div>
			)}
		</div>
	);
}
interface Props {
	result: QueryResult;
	rows: readonly ResultRow[];
	context: DataviewContext;
	config?: DataviewConfig;
	reload?: () => void;
}
function TaskCheck({
	task,
	context,
	reload,
}: {
	task: NonNullable<ResultRow['task']>;
	context: DataviewContext;
	reload?: () => void;
}) {
	const [busy, setBusy] = useState(false),
		[checked, setChecked] = useState(task.checked),
		pending = useRef(false);
	useLayoutEffect(() => setChecked(task.checked), [task.checked]);
	return (
		<input
			className={p1Classes('dashboard-dataview-task-checkbox')}
			type="checkbox"
			checked={checked}
			disabled={busy || task.line < 0}
			onClick={(e) => e.stopPropagation()}
			onChange={(e) => {
				if (pending.current) return;
				const checkbox = e.currentTarget,
					next = checkbox.checked;
				pending.current = true;
				setBusy(true);
				void (async () => {
					let committed = checked;
					try {
						const app = context.app,
							file = contentFiles(app).getFileByPath(task.path);
						if (
							file &&
							(await toggleTaskInFile(
								app,
								{ ...task, file, mtime: file.stat.mtime, ctime: file.stat.ctime },
								next,
							))
						) {
							committed = next;
							setChecked(next);
							invalidatePath(app, task.path);
						}
						reload?.();
					} catch (error) {
						console.error('[Dashboard] query task update failed', error);
					} finally {
						checkbox.checked = committed;
						pending.current = false;
						setBusy(false);
					}
				})();
			}}
		/>
	);
}
export function ResultTable({
	result,
	rows,
	context,
	config,
	reload,
	view,
	sort,
	offset = 0,
}: Props & { view?: ViewState; sort?: (view: ViewState) => void; offset?: number }) {
	const layout = tableLayout(result, config, config?.rowNumbers === true),
		start = displayColumns(result).hasImplicitFileCol ? 1 : 0;
	const activeIndex = view?.sortCol == null ? -1 : layout.sortableIdx[layout.sortValueIdx.indexOf(view.sortCol)];
	return (
		<table
			className={p1Classes(
				`dashboard-library-table dashboard-dataview-table${config?.striped ? ' is-striped' : ''}${config?.density === 'compact' ? ' is-compact' : ''}`,
			)}
		>
			<colgroup>
				{layout.colWidths.map((width, i) => (
					<col key={i} style={width ? { width } : undefined} />
				))}
			</colgroup>
			<thead>
				<tr>
					{layout.labels.map((label, i) => {
						const slot = layout.sortableIdx.indexOf(i),
							active = activeIndex === i;
						return (
							<th
								key={i}
								className={p1Classes(
									slot < 0
										? `is-source-col${layout.checkboxCol && !label ? ' dashboard-dataview-check-head' : ''}${layout.showSource && i === layout.labels.length - 1 ? ' is-datetime' : ''}`
										: `is-sortable${active ? (view?.sortDir === 'desc' ? ' is-sorted-desc' : ' is-sorted-asc') : ''}`,
								)}
								title={
									slot < 0
										? undefined
										: t(
												active
													? view?.sortDir === 'asc'
														? 'dataview.sortDesc'
														: 'dataview.sortClear'
													: 'dataview.sortAsc',
											)
								}
								onClick={() => {
									if (slot >= 0 && view) sort?.(nextSortState(view, layout.sortValueIdx[slot]!));
								}}
							>
								{label}
								{slot >= 0 && (
									<Icon
										className={p1Classes('dashboard-dataview-sort-ind')}
										name={
											active
												? view?.sortDir === 'desc'
													? 'chevron-down'
													: 'chevron-up'
												: 'chevrons-up-down'
										}
									/>
								)}
							</th>
						);
					})}
				</tr>
			</thead>
			<tbody>
				{rows.map((row, i) => {
					const src = sourceInfoOf(row);
					return (
						<tr
							key={row.task ? `${row.task.path}:${row.task.line}` : (row.page?.file.path ?? i)}
							{...rowOpen(context, row)}
						>
							{config?.rowNumbers && (
								<td className={p1Classes('dashboard-dataview-rownum')}>{offset + i + 1}</td>
							)}
							{result.grouped ? (
								<>
									<td className={p1Classes('dashboard-dataview-group-key')}>
										<Value value={row.groupKey ?? null} context={context} />
									</td>
									<td className={p1Classes('dashboard-dataview-group-members-cell')}>
										{row.rows?.length
											? row.rows.map((member, j) => (
													<div
														key={j}
														className={p1Classes('dashboard-dataview-group-member')}
													>
														<Value value={member.values[0] ?? null} context={context} />
													</div>
												))
											: row.values
													.slice(1)
													.map((v, j) => <Value key={j} value={v} context={context} />)}
									</td>
									{Array.from(
										{
											length: Math.max(
												0,
												layout.labels.length - (config?.rowNumbers ? 1 : 0) - 2,
											),
										},
										(_, j) => (
											<td key={j} />
										),
									)}
								</>
							) : (
								<>
									{layout.checkboxCol && (
										<td className={p1Classes('dashboard-dataview-check-col')}>
											{row.task && (
												<TaskCheck task={row.task} context={context} reload={reload} />
											)}
										</td>
									)}
									{row.values.slice(start).map((value, j) => (
										<td
											key={j}
											className={p1Classes(
												value != null && kindOf(value) === 'number' ? 'is-numeric' : undefined,
											)}
										>
											<div className={p1Classes('dashboard-dataview-cell')}>
												<Value value={value} context={context} />
											</div>
										</td>
									))}
									{layout.noteFrom !== 'none' && (
										<td className={p1Classes('dashboard-dataview-src-note')}>
											{layout.noteFrom === 'values0' ? (
												<div className={p1Classes('dashboard-dataview-cell')}>
													<Value value={row.values[0] ?? null} context={context} />
												</div>
											) : (
												(src?.title ?? '—')
											)}
										</td>
									)}
									{layout.showSource && (
										<>
											<td
												className={p1Classes('dashboard-dataview-src-path')}
												title={src?.path ?? ''}
											>
												{src?.path ?? '—'}
											</td>
											<td className={p1Classes('dashboard-dataview-src-created')}>
												{src?.created ?? '—'}
											</td>
										</>
									)}
								</>
							)}
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}
export function ResultList({ result, rows, context, config, reload }: Props) {
	const start = displayColumns(result).hasImplicitFileCol ? 1 : 0;
	return (
		<div
			className={p1Classes(
				`dashboard-library-list dashboard-dataview-list${config?.striped ? ' is-striped' : ''}${config?.density === 'compact' ? ' is-compact' : ''}`,
			)}
		>
			{rows.map((row, i) => {
				const src = sourceInfoOf(row),
					task = result.queryType === 'TASK' ? row.task : undefined,
					events = rowOpen(context, row);
				return (
					<div
						key={i}
						{...events}
						className={p1Classes(
							`dashboard-library-list-item dashboard-dataview-list-item ${events.className}`,
						)}
					>
						{result.grouped && row.groupKey !== undefined ? (
							<>
								<div className={p1Classes('dashboard-dataview-list-group')}>
									<Value value={row.groupKey} context={context} />
								</div>
								<div className={p1Classes('dashboard-dataview-list-members')}>
									{row.rows?.map((member, j) => (
										<div key={j} className={p1Classes('dashboard-dataview-list-member')}>
											<Value value={member.values[0] ?? null} context={context} />
										</div>
									))}
								</div>
							</>
						) : (
							<>
								<div
									className={p1Classes(
										`dashboard-dataview-list-main${task ? ' dashboard-dataview-task-row' : ''}`,
									)}
								>
									{task ? (
										<>
											<TaskCheck task={task} context={context} reload={reload} />
											<span
												className={p1Classes(
													`dashboard-dataview-task-text${task.checked ? ' is-done' : ''}`,
												)}
											>
												<InlineValue
													text={formatValue(row.values[0] ?? null)}
													context={context}
												/>
											</span>
										</>
									) : (
										<>
											<Value
												value={row.values[start] ?? row.values[0] ?? null}
												context={context}
											/>
											{(result.queryType === 'TABLE' || start > 0) &&
												row.values.slice(start + 1).map((value, j) => (
													<Fragment key={j}>
														<span className={p1Classes('dashboard-dataview-list-sep')}>
															·
														</span>
														<Value value={value} context={context} />
													</Fragment>
												))}
										</>
									)}
								</div>
								{config?.showSource !== false && src && (
									<div className={p1Classes('dashboard-dataview-list-source')}>
										{src.path} · {src.created}
									</div>
								)}
							</>
						)}
					</div>
				);
			})}
		</div>
	);
}
export function FreeList({ result, rows, context, reload }: Props) {
	const item = (row: ResultRow, index: number) => {
		const bare = displayColumns(result).hasImplicitFileCol,
			src = sourceInfoOf(row);
		const values: DqlValue[] = [];
		if (!bare && !result.withoutId && src) values.push({ kind: 'link', path: src.path });
		values.push(...row.values);
		return (
			<li key={index} className={p1Classes('dashboard-dataview-free-item')}>
				<div
					className={p1Classes(
						`dashboard-dataview-free-main${result.queryType === 'TASK' && row.task ? ' dashboard-dataview-task-row' : ''}`,
					)}
				>
					{result.queryType === 'TASK' ? (
						row.task ? (
							<>
								<TaskCheck task={row.task} context={context} reload={reload} />
								<span
									className={p1Classes(
										`dashboard-dataview-task-text${row.task.checked ? ' is-done' : ''}`,
									)}
								>
									<InlineValue text={row.task.text} context={context} />
								</span>
							</>
						) : (
							<InlineValue text={formatValue(row.values[0] ?? null)} context={context} />
						)
					) : (
						values.map((value, j) => (
							<Fragment key={j}>
								{j > 0 && <span className={p1Classes('dashboard-dataview-free-sep')}>–</span>}
								<Value value={value} context={context} />
							</Fragment>
						))
					)}
				</div>
			</li>
		);
	};
	return (
		<ul className={p1Classes('dashboard-dataview-free-list')}>
			{rows.map((row, i) =>
				result.grouped && row.groupKey !== undefined ? (
					<li key={i} className={p1Classes('dashboard-dataview-free-group')}>
						<div className={p1Classes('dashboard-dataview-free-group-title')}>
							<Value value={row.groupKey} context={context} />
						</div>
						<ul className={p1Classes('dashboard-dataview-free-list is-nested')}>
							{(row.rows?.length ? row.rows : [row]).map(item)}
						</ul>
					</li>
				) : (
					item(row, i)
				),
			)}
		</ul>
	);
}
export function ResultCalendar({ result, rows, context }: Props) {
	const dated = rows
		.map((row) => ({ row, ts: rowDateTs(row, result) }))
		.filter((entry): entry is { row: ResultRow; ts: number } => entry.ts !== null);
	const [cursor, setCursor] = useState(() =>
		monthStart(dated.length ? Math.max(...dated.map((d) => d.ts)) : Date.now()),
	);
	if (!dated.length) return <EmptyResult message="dataview.calendarNoDates" />;
	const byDay = new Map<string, ResultRow[]>();
	for (const d of dated) byDay.set(dayKey(d.ts), [...(byDay.get(dayKey(d.ts)) ?? []), d.row]);
	const start = new Date(cursor),
		days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
	return (
		<div className={p1Classes('dashboard-dataview-calendar')}>
			<div className={p1Classes('dashboard-dataview-calendar-grid')}>
				<div className={p1Classes('dashboard-dataview-calendar-header')}>
					<button
						className={p1Classes('dashboard-dataview-calendar-nav')}
						onClick={() => setCursor(shiftMonth(cursor, -1))}
					>
						<Icon name="chevron-left" />
					</button>
					<div className={p1Classes('dashboard-dataview-calendar-title')}>{monthLabel(cursor)}</div>
					<button
						className={p1Classes('dashboard-dataview-calendar-nav')}
						onClick={() => setCursor(shiftMonth(cursor, 1))}
					>
						<Icon name="chevron-right" />
					</button>
				</div>
				<div className={p1Classes('dashboard-dataview-calendar-weekdays')}>
					{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
						<div key={i} className={p1Classes('dashboard-dataview-calendar-wd')}>
							{day}
						</div>
					))}
				</div>
				<div className={p1Classes('dashboard-dataview-calendar-cells')}>
					{Array.from({ length: start.getDay() }, (_, i) => (
						<div key={`blank${i}`} className={p1Classes('dashboard-dataview-calendar-cell is-blank')} />
					))}
					{Array.from({ length: days }, (_, i) => {
						const day = i + 1,
							items =
								byDay.get(dayKey(new Date(start.getFullYear(), start.getMonth(), day).getTime())) ?? [];
						return (
							<div
								key={day}
								className={p1Classes(
									`dashboard-dataview-calendar-cell${items.length ? ' has-dots' : ''}`,
								)}
								onClick={() => {
									const path = items[0]?.page?.file.path;
									const file = path ? contentFiles(context.app).getFileByPath(path) : null;
									if (file) context.opener?.(file);
								}}
							>
								<div className={p1Classes('dashboard-dataview-calendar-day')}>{day}</div>
								{items.length > 0 && (
									<div className={p1Classes('dashboard-dataview-calendar-dots')}>
										{items.slice(0, 3).map((_, j) => (
											<div key={j} className={p1Classes('dashboard-dataview-calendar-dot')} />
										))}
										{items.length > 3 && (
											<div className={p1Classes('dashboard-dataview-calendar-more')}>
												+{items.length - 3}
											</div>
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
export function ResultHeatmap({ rows }: { rows: readonly ResultRow[] }) {
	const totals = new Map<string, number>();
	for (const row of rows) {
		const value = coerceNumber(row.values[0] ?? null),
			date = row.values[1];
		if (value != null && date && kindOf(date) === 'date') {
			const key = ymdKey((date as { ts: number }).ts);
			totals.set(key, (totals.get(key) ?? 0) + value);
		}
	}
	const dates = [...totals.keys()].sort(),
		year = Number(dates.at(-1)?.slice(0, 4) ?? new Date().getFullYear());
	const points = fillYearHeatmapData(totals, year),
		columns = buildDataviewWeekColumns(points),
		labels = computeDataviewMonthLabels(columns);
	const values = [...totals.values()],
		min = Math.min(...values),
		range = Math.max(...values) - min || 1;
	const ref = useRef<HTMLDivElement>(null),
		[cell, setCell] = useState(10);
	useLayoutEffect(() => {
		const el = ref.current,
			win = el?.ownerDocument.defaultView;
		if (!el || !win) return;
		const resize = () => setCell(chooseDataviewCellSize(el.parentElement?.clientWidth ?? 800, columns.length));
		const frame = win.requestAnimationFrame(resize);
		const observer = new win.ResizeObserver(resize);
		observer.observe(el);
		return () => {
			win.cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [columns.length]);
	if (!totals.size) return <EmptyResult message="dataview.heatmapNoData" />;
	return (
		<div className={p1Classes('dashboard-heatmap-section-body dashboard-dataview-heatmap-body')}>
			<div
				ref={ref}
				className={p1Classes('dashboard-heatmap-year')}
				style={{ '--hm-cell': `${cell}px` } as import('react').CSSProperties}
			>
				<div
					className={p1Classes('dashboard-heatmap-months-top')}
					style={{ gridTemplateColumns: `repeat(${columns.length}, ${cell}px)` }}
				>
					{labels.map((label, i) => (
						<div key={i} className={p1Classes('dashboard-heatmap-month-label-top')}>
							{label}
						</div>
					))}
				</div>
				<div className={p1Classes('dashboard-heatmap-grid')}>
					{columns.flatMap((column, i) =>
						Array.from({ length: 7 }, (_, j) => {
							const point = column[j],
								value = point?.value,
								intensity = value == null ? 0 : Math.max(0, Math.min(1, (value - min) / range));
							return (
								<div
									key={`${i}:${j}`}
									className={p1Classes(
										`dashboard-sidebar-heatmap-cell${value == null ? ' dashboard-sidebar-heatmap-cell--empty' : ''}`,
									)}
									title={value == null ? undefined : `${point!.date}: ${value}`}
									style={
										value == null
											? undefined
											: {
													backgroundColor: 'var(--db-accent, var(--interactive-accent))',
													opacity: 0.35 + intensity * 0.65,
													filter: `brightness(${1 + intensity * 0.5}) saturate(1.4)`,
												}
									}
								/>
							);
						}),
					)}
				</div>
			</div>
		</div>
	);
}
