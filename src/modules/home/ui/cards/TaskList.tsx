// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts
import { useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bell, ChevronDown, GripVertical } from 'lucide-react';
import { Checkbox } from '../../../../ui/components/checkbox';
import { Input } from '../../../../ui/components/input';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import type { DashboardCard, TaskItem } from '../../core/board/types/model';
import { IconButton } from '../board/controls';
import { MarkdownBody } from './MemoBody';
const taskId = (card: string, path: number[]) => `task:${card}:${path.join('.')}`;
function TaskRow({ store, card, task, path }: { store: BoardStore; card: string; task: TaskItem; path: number[] }) {
	const t = useT(),
		{ attributes, isDragging, listeners, setNodeRef, transform } = useSortable({
			id: taskId(card, path),
			data: { item: { kind: 'task', card, path } },
		});
	return (
		<div
			ref={setNodeRef}
			style={{
				transform: CSS.Transform.toString(transform),
				opacity: isDragging ? 0.4 : undefined,
			}}
		>
			<div className="group/task relative mb-1.5 flex items-start gap-2 rounded-[var(--db-radius-sm)] border border-[var(--db-border-card)] py-1.5 pr-[10px] pl-8">
				<IconButton
					label={t('home.dashboard.drag')}
					className="absolute left-1 size-4 shrink-0 opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
					{...attributes}
					{...listeners}
				>
					<GripVertical className="size-3" />
				</IconButton>
				<Checkbox
					checked={task.checked}
					aria-label={task.text}
					className="mt-0.5 rounded-full"
					onCheckedChange={(checked) => {
						void store.sync.toggleTask(card, path, checked === true);
					}}
				/>
				<div className={`min-w-0 flex-1 [&_p]:m-0 ${task.checked ? 'text-muted-foreground line-through' : ''}`}>
					<MarkdownBody store={store} text={task.text} />
				</div>
				<IconButton
					label={t('home.dashboard.reminder')}
					onClick={() => {
						void store.sync
							.taskAutomationSource(card, path)
							.then((source) =>
								store.host.automationHost?.edit(
									{ kind: 'dashboard', path: source.path, id: source.id },
									source.title,
								),
							);
					}}
				>
					<Bell className="size-3" />
				</IconButton>
				{!!task.children?.length && (
					<IconButton
						label={t('home.dashboard.collapse')}
						aria-expanded={!task.collapsed}
						onClick={() => {
							void store.sync.toggleCollapseTask(card, path);
						}}
					>
						<ChevronDown className={task.collapsed ? '-rotate-90' : ''} />
					</IconButton>
				)}
			</div>
			{!task.collapsed && !!task.children?.length && (
				<div className="ml-5">
					<TaskRows store={store} card={card} tasks={task.children} parent={path} />
				</div>
			)}
		</div>
	);
}
function TaskRows({
	store,
	card,
	tasks,
	parent = [],
}: {
	store: BoardStore;
	card: string;
	tasks: TaskItem[];
	parent?: number[];
}) {
	return (
		<SortableContext
			items={tasks.map((_, i) => taskId(card, [...parent, i]))}
			strategy={verticalListSortingStrategy}
		>
			{tasks.map((task, i) => (
				<TaskRow key={task.id ?? i} store={store} card={card} task={task} path={[...parent, i]} />
			))}
		</SortableContext>
	);
}
export function TaskList({ store, card }: { store: BoardStore; card: DashboardCard }) {
	const t = useT(),
		[text, setText] = useState('');
	const flatten = (tasks: TaskItem[]): TaskItem[] => tasks.flatMap((task) => [task, ...flatten(task.children ?? [])]);
	const tasks = flatten(card.tasks),
		progress = tasks.length ? Math.round((tasks.filter((task) => task.checked).length / tasks.length) * 100) : 0;
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2">
			<div className="min-h-0 flex-1 overflow-y-auto">
				<TaskRows store={store} card={card.id} tasks={card.tasks} />
			</div>
			<Input
				aria-label={t('home.dashboard.addTask')}
				placeholder={t('home.dashboard.addTask')}
				value={text}
				className="h-7 text-xs"
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && !e.nativeEvent.isComposing && text.trim()) {
						void store.sync.addTask(card.id, text).then(() => setText(''));
					}
				}}
			/>
			<div className="mb-1.5 flex items-center gap-2 text-[.82em] text-muted-foreground">
				<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
					<div
						className="h-full bg-gradient-to-r from-[var(--db-progress-from)] to-[var(--db-progress-to)]"
						style={{ width: `${progress}%` }}
					/>
				</div>
				{progress}%
			</div>
		</div>
	);
}
