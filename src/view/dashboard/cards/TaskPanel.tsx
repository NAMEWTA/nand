import type { App } from 'obsidian';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { DashboardCard, TaskItem } from '../../../core/dashboard/types/index';
import { t } from '../../../shared/i18n/index';
import { Icon } from '../../primitives/Icon';
import type { RenderCallbacks } from '../render-contract';
import type { DashboardRenderContext } from '../renderer/render-context';
import { isReminderOverdue } from '../renderer/render-text-with-links';
import { InlineLinks } from './InlineLinks';
import { ReminderPicker } from './ReminderPicker';
import { itemDrag, listDrop, useFileSuggest, useTaskTouch } from './card-interactions';

export interface CardBodyProps {
	card: DashboardCard;
	callbacks: RenderCallbacks;
	app: App;
	context: DashboardRenderContext;
}
function completion(task: TaskItem): number {
	return task.children?.length
		? task.children.reduce((sum, child) => sum + completion(child), 0) / task.children.length
		: task.checked
			? 1
			: 0;
}

function TaskRow({
	task,
	path,
	hidden = false,
	...props
}: CardBodyProps & { task: TaskItem; path: number[]; hidden?: boolean }) {
	const { card, callbacks, app, context } = props;
	const [collapsed, setCollapsed] = useState(task.collapsed);
	const [reminderAnchor, setReminderAnchor] = useState<HTMLElement | null>(null);
	const [editing, setEditing] = useState(false);
	const edit = useRef<HTMLTextAreaElement>(null);
	const finishing = useRef(false);
	const row = useTaskTouch(
		() => callbacks.onTaskNest(card.id, path),
		() => callbacks.onTaskUnnest(card.id, path),
	);
	useLayoutEffect(() => setCollapsed(task.collapsed), [task.collapsed]);
	useLayoutEffect(() => {
		if (editing && edit.current) {
			finishing.current = false;
			edit.current.value = task.text;
			resize(edit.current);
			edit.current.focus();
			edit.current.setSelectionRange(task.text.length, task.text.length);
		}
	}, [editing, task.text]);
	const finish = (save: boolean) => {
		if (finishing.current) return;
		finishing.current = true;
		const value = edit.current?.value.trim();
		setEditing(false);
		if (save && value && value !== task.text) callbacks.onTaskEdit(card.id, path, value);
	};
	const hasChildren = !!task.children?.length;
	const reminder = !!(task.reminder || task.automation);
	return (
		<>
			<div
				ref={row}
				class={`dashboard-task-item${path.length > 1 ? ' dashboard-task-item--child' : ''}${hidden ? ' dashboard-task-item--hidden' : ''}`}
				style={{ marginLeft: (path.length - 1) * 18 }}
				draggable={!editing}
				data-task-path={JSON.stringify(path)}
				data-card-id={card.id}
				aria-expanded={hasChildren ? !collapsed : undefined}
				{...itemDrag(context, callbacks, 'task', card.id, path)}
			>
				{hasChildren && (
					<div
						class="dashboard-task-toggle dashboard-task-toggle--active"
						role="button"
						tabIndex={0}
						aria-label={t(collapsed ? 'renderer.expandTask' : 'renderer.collapseTask')}
						onClick={(event) => {
							event.stopPropagation();
							setCollapsed(!collapsed);
							callbacks.onTaskToggleCollapse(card.id, path);
						}}
						onKeyDown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								event.currentTarget.click();
							}
						}}
					>
						<Icon name={collapsed ? 'chevron-right' : 'chevron-down'} />
					</div>
				)}
				<input
					class="dashboard-task-checkbox"
					type="checkbox"
					checked={task.checked}
					onChange={(event) => callbacks.onCheckboxToggle(card.id, path, event.currentTarget.checked)}
				/>
				<span
					class={`dashboard-task-text${task.checked ? ' dashboard-task-text--done' : ''}`}
					onDblClick={(event) => {
						event.stopPropagation();
						setEditing(true);
					}}
				>
					{editing ? (
						<textarea
							ref={edit}
							class="dashboard-task-edit-textarea"
							onInput={(event) => resize(event.currentTarget)}
							onKeyDown={(event) => {
								if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
									event.preventDefault();
									finish(true);
								} else if (event.key === 'Escape') {
									event.preventDefault();
									finish(false);
								}
							}}
							onBlur={() => finish(true)}
						/>
					) : (
						<InlineLinks text={task.text} app={app} context={context} />
					)}
				</span>
				<button
					class="dashboard-task-delete"
					aria-label={t('renderer.deleteTask')}
					onClick={(event) => {
						event.stopPropagation();
						callbacks.onTaskDelete(card.id, path);
					}}
				>
					<Icon name="x" />
				</button>
				<button
					draggable={false}
					class={`dashboard-task-reminder-btn${reminder ? ' dashboard-task-reminder-btn--active' : ''}${!task.checked && task.reminder && isReminderOverdue(task.reminder) ? ' dashboard-task-reminder-btn--overdue' : ''}`}
					aria-label={t(reminder ? 'reminder.editReminder' : 'reminder.setReminder')}
					onClick={(event) => {
						event.stopPropagation();
						event.preventDefault();
						if (callbacks.onTaskAutomationEdit) callbacks.onTaskAutomationEdit(card.id, path);
						else setReminderAnchor(event.currentTarget);
					}}
				>
					<Icon name={reminder ? 'bell-ring' : 'bell'} />
				</button>
			</div>
			{reminderAnchor && !hidden && (
				<ReminderPicker
					anchor={reminderAnchor}
					value={task.reminder}
					close={() => setReminderAnchor(null)}
					save={(value) => callbacks.onTaskReminderEdit(card.id, path, value)}
				/>
			)}
			{task.children?.map((child, index) => (
				<TaskRow key={index} {...props} task={child} path={[...path, index]} hidden={hidden || collapsed} />
			))}
		</>
	);
}
function resize(input: HTMLTextAreaElement) {
	input.setCssProps({ height: 'auto' });
	input.style.height = input.scrollHeight + 'px';
}
export function TaskPanel(props: CardBodyProps) {
	const { card, callbacks, app, context } = props;
	const { input, suggest } = useFileSuggest<HTMLInputElement>(app);
	const percent = card.tasks.length
		? Math.round((card.tasks.reduce((sum, task) => sum + completion(task), 0) / card.tasks.length) * 100)
		: 0;
	return (
		<>
			<div
				class="dashboard-task-list"
				data-card-id={card.id}
				{...listDrop(context, callbacks, 'task', card.id, card.tasks.length)}
			>
				{card.tasks.map((task, index) => (
					<TaskRow key={index} {...props} task={task} path={[index]} />
				))}
			</div>
			<div class="dashboard-task-add">
				<input
					ref={input}
					class="dashboard-task-input"
					type="text"
					placeholder={t('renderer.addTask')}
					onKeyDown={(event) => {
						if (
							event.defaultPrevented ||
							event.isComposing ||
							suggest.current?.isActive() ||
							event.key !== 'Enter'
						)
							return;
						const value = event.currentTarget.value.trim();
						if (value) {
							callbacks.onTaskAdd(card.id, value);
							event.currentTarget.value = '';
						}
					}}
				/>
			</div>
			{card.tasks.length > 0 && (
				<div class="dashboard-progress">
					<div class="dashboard-progress-bar">
						<div class="dashboard-progress-fill" style={{ width: `${percent}%` }} />
					</div>
					<span class="dashboard-progress-text">{percent}%</span>
				</div>
			)}
		</>
	);
}
