// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/ticktick-section.ts
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from 'zustand';
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
	sortableKeyboardCoordinates,
	arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Circle, Pencil, RefreshCw, Filter, LogIn, LayoutGrid, List } from 'lucide-react';
import {
	TickTickClient,
	parseTickDate,
	type TickTickTask,
	type TickTickProject,
	type TickTickHabit,
} from '../../platform/ticktick/ticktick-service';
import { DEFAULT_TICKTICK_TZ, isValidTz, tzDayNum, tzParts, tzStamp } from '../../core/ticktick/ticktick-tz';
import { computeSortOrder } from '../../core/ticktick/task-order';
import type { BoardStore } from '../../services/board-store';
import type { DashboardColumn, TickTickConfig } from '../../core/board/types';
import { useVisible, useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { Checkbox } from '../../../../ui/components/checkbox';
import { IconButton } from '../board/controls';
import { RenameTitle } from '../board/RenameTitle';
import { ResizeHandle } from '../board/ResizeHandle';
import { P2Dialog } from '../dialogs/P2Dialog';
import { TickTickLoginDialog, TickTickEditDialog } from './TickTickDialogs';
import { p2Classes as c } from '../theme/p2-classes';
interface Data {
	projects: TickTickProject[];
	tasks: TickTickTask[];
	completed: TickTickTask[];
	habits: TickTickHabit[];
	done: string[];
	inboxId?: string;
}
export function TickTickSection({
	store,
	column,
	actions,
}: {
	store: BoardStore;
	column: DashboardColumn;
	actions?: HTMLElement | null;
}) {
	const t = useT(),
		visible = useVisible(),
		doc = useOwnerDocument(),
		s = useStore(store.state, (x) => x.settings),
		client = useMemo(
			() => new TickTickClient(s.ticktickRegion, s.ticktickCookie, s.ticktickDeviceVersion, s.ticktickCsrf),
			[s.ticktickRegion, s.ticktickCookie, s.ticktickDeviceVersion, s.ticktickCsrf],
		),
		tz = isValidTz(s.ticktickTimezone) ? s.ticktickTimezone : DEFAULT_TICKTICK_TZ;
	const config = column.ticktickConfig ?? { view: 'today' },
		[data, setData] = useState<Data | null>(null),
		[revision, setRevision] = useState(0),
		[error, setError] = useState(''),
		[writeWarning, setWriteWarning] = useState(''),
		[login, setLogin] = useState(false),
		[filter, setFilter] = useState<string[] | null>(null),
		[editing, setEditing] = useState<TickTickTask | null>(null),
		[busy, setBusy] = useState(false);
	const writing = useRef(false),
		writeLifetime = useRef<AbortController | null>(null);
	useEffect(() => {
		const controller = new AbortController();
		writeLifetime.current = controller;
		writing.current = false;
		setBusy(false);
		setEditing(null);
		setLogin(false);
		setWriteWarning('');
		if (!visible) controller.abort();
		return () => {
			controller.abort();
		};
	}, [client, visible]);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	useEffect(() => {
		if (!visible) return;
		const controller = new AbortController(),
			lifetime = { signal: controller.signal, ownerWindow: doc.defaultView! };
		setError('');
		setData(null);
		if (client.isConfigured())
			void (async () => {
				try {
					if (revision) client.clearCache();
					const snapshot = await client.fetchSnapshot(lifetime),
						completed = await client.fetchCompleted(lifetime),
						habits = await client.fetchHabits(lifetime),
						checkins = await client.fetchHabitCheckins(
							habits.map((h) => h.id),
							tzStamp(new Date(), tz),
							lifetime,
						);
					if (!controller.signal.aborted)
						setData({ ...snapshot, completed, habits, done: checkins.map((x) => x.habitId) });
				} catch (e) {
					if (!controller.signal.aborted) setError(tickError(e, t));
				}
			})();
		return () => {
			controller.abort();
		};
	}, [client, revision, tz, visible, t, doc]);
	const patch = async (next: TickTickConfig) => {
		await store.edit((board) => {
			const col = board.columns.find((x) => (x.id ?? x.name) === (column.id ?? column.name));
			if (col) col.ticktickConfig = next;
		});
	};
	const update = async (task: TickTickTask, fields: Partial<TickTickTask>) => {
		const controller = writeLifetime.current;
		if (!controller || controller.signal.aborted) throw Error('CANCELLED');
		if (writing.current) throw Error(t('storage.unsaved'));
		writing.current = true;
		setBusy(true);
		try {
			await client.updateTask(task.projectId ?? '', task.id, fields, {
				signal: controller.signal,
				ownerWindow: doc.defaultView!,
			});
			if (controller.signal.aborted) throw Error('CANCELLED');
			setWriteWarning('');
			setData((current) => {
				if (!current) return current;
				const changed = { ...task, ...fields };
				return {
					...current,
					tasks: current.tasks.some((x) => x.id === task.id)
						? current.tasks.map((x) => (x.id === task.id ? changed : x))
						: [...current.tasks, changed],
					completed:
						changed.status === 2
							? [changed, ...current.completed.filter((x) => x.id !== task.id)]
							: current.completed.filter((x) => x.id !== task.id),
				};
			});
		} catch (e) {
			const message = tickError(e, t);
			if (!controller.signal.aborted) {
				if (e instanceof Error && e.message === 'WRITE_TIMEOUT') {
					setWriteWarning(message);
					client.clearCache();
					setRevision((n) => n + 1);
				} else setError(message);
			}
			throw Error(message);
		} finally {
			if (writeLifetime.current === controller) {
				writing.current = false;
				setBusy(false);
			}
		}
	};
	const rows = (tasks: TickTickTask[], pid?: string) => {
		const body = tasks.map((task) => (
			<TaskRow
				key={task.id}
				task={task}
				tz={tz}
				project={data?.projects.find((p) => p.id === task.projectId)?.name}
				disabled={busy || !client.canWrite()}
				sortable={!!pid}
				onToggle={() => {
					void update(task, {
						status: task.status === 2 ? 0 : 2,
						completedTime: task.status === 2 ? undefined : new Date().toISOString(),
					}).catch(() => {});
				}}
				onRename={(title) => update(task, { title })}
				onEdit={() => setEditing(task)}
			/>
		));
		return pid ? (
			<DndContext
				sensors={sensors}
				onDragEnd={({ active, over }) => {
					if (!over || active.id === over.id || busy) return;
					const moved = tasks.find((x) => x.id === active.id);
					const from = tasks.findIndex((x) => x.id === active.id),
						to = tasks.findIndex((x) => x.id === over.id);
					if (moved && from >= 0 && to >= 0) {
						const reordered = arrayMove(tasks, from, to);
						void update(moved, {
							sortOrder: computeSortOrder(moved.id, reordered[to + 1]?.id ?? null, tasks),
						}).catch(() => {});
					}
				}}
			>
				<SortableContext items={tasks.map((x) => x.id)} strategy={verticalListSortingStrategy}>
					{body}
				</SortableContext>
			</DndContext>
		) : (
			body
		);
	};
	const today = tzDayNum(new Date(), tz),
		todayTasks = (data?.tasks ?? [])
			.filter(
				(x) =>
					x.status === 0 &&
					!!x.dueDate &&
					!!parseTickDate(x.dueDate) &&
					tzDayNum(parseTickDate(x.dueDate)!, tz) <= today,
			)
			.sort(
				(a, b) =>
					(parseTickDate(a.dueDate)?.getTime() ?? 0) - (parseTickDate(b.dueDate)?.getTime() ?? 0) ||
					b.priority - a.priority,
			),
		done = (data?.completed ?? [])
			.filter((x) => x.completedTime && tzDayNum(parseTickDate(x.completedTime) ?? new Date(0), tz) >= today - 2)
			.sort(
				(a, b) =>
					(parseTickDate(b.completedTime)?.getTime() ?? 0) - (parseTickDate(a.completedTime)?.getTime() ?? 0),
			);
	const groups = new Map<string, TickTickTask[]>();
	for (const task of data?.tasks ?? []) {
		const pid = task.projectId ?? data?.inboxId ?? 'inbox';
		if (task.status === 0 && !config.hiddenProjects?.includes(pid))
			groups.set(pid, [...(groups.get(pid) ?? []), task]);
	}
	if (!visible) return null;
	return (
		<div className={c('dashboard-ticktick-widgets')}>
			{actions &&
				createPortal(
					<>
						<IconButton
							label={t('ticktick.viewToday')}
							aria-pressed={config.view === 'today'}
							onClick={() => {
								void patch({ ...config, view: 'today' }).catch((e) => setError(String(e)));
							}}
						>
							<LayoutGrid />
						</IconButton>
						<IconButton
							label={t('ticktick.viewLists')}
							aria-pressed={config.view === 'lists'}
							onClick={() => {
								void patch({ ...config, view: 'lists' }).catch((e) => setError(String(e)));
							}}
						>
							<List />
						</IconButton>
						{config.view === 'lists' && (
							<IconButton
								label={t('ticktick.filterProjects')}
								onClick={() => setFilter(config.hiddenProjects ?? [])}
							>
								<Filter />
							</IconButton>
						)}
						<IconButton label={t('ticktick.refresh')} onClick={() => setRevision((n) => n + 1)}>
							<RefreshCw />
						</IconButton>
						<IconButton label={t('ticktick.loginTitle')} onClick={() => setLogin(true)}>
							<LogIn />
						</IconButton>
					</>,
					actions,
				)}
			{(writeWarning || error) && (
				<p role="alert" className="text-destructive">
					{writeWarning || error}
				</p>
			)}
			{!client.isConfigured() ? (
				<Hint title={t('ticktick.noCookie')} hint={t('ticktick.noCookieHint')} />
			) : !data ? (
				<Hint title={t(error ? 'ticktick.loadFailed' : 'ticktick.loading')} />
			) : (
				<>
					{!client.canWrite() && (
						<div className={c('dashboard-ticktick-readonly-hint')}>{t('ticktick.readonlyHint')}</div>
					)}
					{config.view === 'today' ? (
						<div className={c('dashboard-ticktick-proj-grid')}>
							<TaskCard
								title={t('ticktick.viewToday')}
								count={todayTasks.length}
								color="var(--db-ticktick-today)"
							>
								{todayTasks.length ? rows(todayTasks) : <Hint title={t('ticktick.todayEmpty')} />}
							</TaskCard>
							<TaskCard
								title={t('ticktick.viewCompleted')}
								count={done.length}
								color="var(--db-ticktick-done)"
							>
								{done.length ? rows(done) : <Hint title={t('ticktick.noCompleted')} />}
							</TaskCard>
							<TaskCard
								title={t('ticktick.viewHabits')}
								count={data.habits.length}
								color="var(--db-ticktick-habit)"
							>
								{data.habits.length ? (
									data.habits.map((h) => (
										<div
											key={h.id}
											className={c('dashboard-ticktick-row dashboard-ticktick-row--habit')}
										>
											<span
												className={c(
													`dashboard-ticktick-check ${data.done.includes(h.id) ? 'dashboard-ticktick-check--done' : ''}`,
												)}
											>
												{data.done.includes(h.id) ? <Check /> : <Circle />}
											</span>
											<div className={c('dashboard-ticktick-main')}>
												<div className={c('dashboard-ticktick-title')}>{h.name}</div>
												{h.goal && (
													<div className={c('dashboard-ticktick-meta')}>
														{h.goal}
														{h.unit ?? ''}
													</div>
												)}
											</div>
										</div>
									))
								) : (
									<Hint title={t('ticktick.noHabits')} />
								)}
							</TaskCard>
						</div>
					) : (
						<div className={c('dashboard-ticktick-proj-row')}>
							{!groups.size && <Hint title={t('ticktick.noTasks')} />}{' '}
							{[...groups].map(([pid, tasks]) => (
								<TaskCard
									key={pid}
									title={data.projects.find((p) => p.id === pid)?.name ?? t('ticktick.inbox')}
									count={tasks.length}
									color={
										data.projects.find((p) => p.id === pid)?.color ?? 'var(--db-ticktick-project)'
									}
									width={config.projectWidths?.[pid]}
									resize={(width) => {
										void patch({
											...config,
											projectWidths: { ...config.projectWidths, [pid]: width },
										}).catch((e) => setError(String(e)));
									}}
								>
									{rows(
										tasks.sort(
											(a, b) =>
												(b.sortOrder ?? 0) - (a.sortOrder ?? 0) || b.priority - a.priority,
										),
										pid,
									)}
								</TaskCard>
							))}
						</div>
					)}
				</>
			)}
			{login && <TickTickLoginDialog host={store.host} settings={s} onClose={() => setLogin(false)} />}
			{editing && (
				<TickTickEditDialog
					task={editing}
					tz={tz}
					onSave={(fields) => update(editing, fields)}
					onClose={() => setEditing(null)}
				/>
			)}
			{filter && (
				<P2Dialog
					title={t('ticktick.filterProjects')}
					onClose={() => setFilter(null)}
					onSave={() => patch({ ...config, hiddenProjects: filter })}
				>
					<div className={c('dashboard-library-config-filters')}>
						{(data?.projects ?? []).map((p) => (
							<label key={p.id} className={c('dashboard-library-config-inline-row')}>
								<Checkbox
									checked={!filter.includes(p.id)}
									onCheckedChange={(on) =>
										setFilter(on ? filter.filter((id) => id !== p.id) : [...filter, p.id])
									}
								/>
								{p.name}
							</label>
						))}
					</div>
				</P2Dialog>
			)}
		</div>
	);
}
function Hint({ title, hint }: { title: string; hint?: string }) {
	return (
		<div className={c('dashboard-ticktick-hint')}>
			<div className={c('dashboard-ticktick-hint-title')}>{title}</div>
			{hint && <div className={c('dashboard-ticktick-hint-desc')}>{hint}</div>}
		</div>
	);
}
function TaskCard({
	title,
	count,
	color,
	width,
	resize,
	children,
}: {
	title: string;
	count: number;
	color: string;
	width?: number;
	resize?: (width: number) => void;
	children: ReactNode;
}) {
	const t = useT(),
		[preview, setPreview] = useState<number>();
	const w = preview ?? width;
	return (
		<div
			className={c('dashboard-ticktick-proj-card')}
			style={
				{
					'--proj-color': color,
					borderTopColor: color,
					borderTopWidth: 3,
					...(w ? { flex: `0 0 ${w}px`, minWidth: w, maxWidth: w } : {}),
				} as CSSProperties
			}
		>
			<div className={c('dashboard-ticktick-proj-card-head')}>
				<div className={c('dashboard-ticktick-proj-dot')} style={{ backgroundColor: color }} />
				<div className={c('dashboard-ticktick-group-name')}>{title}</div>
				<div className={c('dashboard-ticktick-group-count')}>{count}</div>
			</div>
			<div className={c('dashboard-ticktick-list')}>{children}</div>
			{resize && (
				<ResizeHandle
					label={t('home.dashboard.resizeWidth')}
					axis="x"
					value={w ?? 280}
					min={200}
					max={500}
					className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
					onPreview={setPreview}
					onCommit={resize}
				/>
			)}
		</div>
	);
}
function TaskRow({
	task,
	tz,
	project,
	disabled,
	sortable,
	onToggle,
	onRename,
	onEdit,
}: {
	task: TickTickTask;
	tz: string;
	project?: string;
	disabled: boolean;
	sortable: boolean;
	onToggle: () => void;
	onRename: (value: string) => Promise<void>;
	onEdit: () => void;
}) {
	const t = useT(),
		{ attributes, listeners, setNodeRef, transform } = useSortable({
			id: task.id,
			disabled: disabled || !sortable,
		}),
		due = parseTickDate(task.dueDate),
		diff = due ? tzDayNum(due, tz) - tzDayNum(new Date(), tz) : 0,
		parts = due ? tzParts(due, tz) : null;
	const completed = task.status === 2 ? parseTickDate(task.completedTime) : null;
	const doneParts = completed ? tzParts(completed, tz) : null;
	const meta =
		task.status === 2
			? doneParts
				? `${String(doneParts.hour).padStart(2, '0')}:${String(doneParts.minute).padStart(2, '0')}`
				: ''
			: [
					due
						? diff < 0
							? t('ticktick.overdue', { n: -diff })
							: diff === 0
								? t('ticktick.dueToday')
								: `${parts!.month}/${parts!.day}`
						: '',
					project,
					...(task.tags ?? []).map((x) => `#${x}`),
				]
					.filter(Boolean)
					.join(' · ');
	return (
		<div
			ref={setNodeRef}
			className={c(`dashboard-ticktick-row ${task.status === 2 ? 'dashboard-ticktick-row--done' : ''}`)}
			style={{ transform: CSS.Transform.toString(transform) }}
			{...attributes}
			{...listeners}
		>
			<IconButton
				disabled={disabled}
				className={c(`dashboard-ticktick-check ${task.status === 2 ? 'dashboard-ticktick-check--done' : ''}`)}
				label={t('home.p2.toggleTask', { name: task.title })}
				onClick={onToggle}
			>
				{task.status === 2 ? <Check /> : <Circle />}
			</IconButton>
			<div className={c('dashboard-ticktick-main')}>
				<div className={c('dashboard-ticktick-title-line')}>
					<div
						className={c(
							`dashboard-ticktick-title ${task.status === 2 ? 'dashboard-ticktick-title--done' : ''}`,
						)}
					>
						{disabled ? task.title : <RenameTitle value={task.title} onRename={onRename} />}
					</div>
					{task.repeatFlag && (
						<span className={c('dashboard-ticktick-badge')}>{t('ticktick.recurring')}</span>
					)}
					{!disabled && task.status !== 2 && (
						<IconButton
							label={t('ticktick.editTask')}
							className={c('dashboard-ticktick-edit-btn')}
							onClick={onEdit}
						>
							<Pencil />
						</IconButton>
					)}
				</div>
				{meta && <div className={c('dashboard-ticktick-meta')}>{meta}</div>}
			</div>
		</div>
	);
}
function tickError(error: unknown, t: (key: string) => string): string {
	const code = error instanceof Error ? error.message : '';
	if (code === 'WRITE_TIMEOUT') return t('ticktick.writeUncertain');
	return t(
		code === 'BAD_COOKIE' || code === 'NO_COOKIE' || code === 'NO_CSRF'
			? 'ticktick.badCookie'
			: code === 'RATE_LIMITED'
				? 'ticktick.rateLimited'
				: code.startsWith('NETWORK') || code === 'TIMEOUT'
					? 'ticktick.networkError'
					: 'ticktick.loadFailed',
	);
}
