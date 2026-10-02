import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { CardSize } from '../../../core/dashboard/types/index';
import { t } from '../../../shared/i18n/index';
import { Icon } from '../../primitives/Icon';
import { resolveVaultImage } from '../banner/banner';
import { MemoPanel } from './MemoPanel';
import { ProjectPanel } from './ProjectPanel';
import { TaskPanel, type CardBodyProps } from './TaskPanel';
import { TrackerPanel } from './TrackerPanel';
import { WeatherPanel } from './WeatherPanel';
import { WebShortcutPanel } from './WebShortcutPanel';
import { listDrop } from './card-interactions';
export function cardKind(section: string, type: string) {
	return section === 'memo' || (section === 'sticky' && (type === 'generic' || type === 'note'))
		? 'memo'
		: type === 'task' || section === 'todo'
			? 'task'
			: 'project';
}
export function CardPanel(props: CardBodyProps & { root: HTMLElement; sectionType: string }) {
	const { card, callbacks, app, context, root, sectionType } = props;
	const widget = card.type === 'weather' || card.type === 'tracker';
	const kind = cardKind(sectionType, card.type);
	const project = !widget && card.type !== 'web' && kind === 'project';
	const cover =
		project &&
		sectionType !== 'dashboard' &&
		sectionType !== 'notes' &&
		(sectionType !== 'sticky' || card.noteStyle !== 'plain');
	const [editing, setEditing] = useState(false);
	const title = useRef<HTMLInputElement>(null);
	const color = useRef<HTMLInputElement>(null);
	const finished = useRef(false);
	const cleanupResize = useRef<(() => void) | null>(null);
	useLayoutEffect(() => () => cleanupResize.current?.(), []);
	useLayoutEffect(() => {
		if (editing && title.current) {
			finished.current = false;
			title.current.value = card.title;
			title.current.focus();
			title.current.select();
		}
	}, [editing, card.title]);
	const finish = (save: boolean) => {
		if (finished.current) return;
		finished.current = true;
		const value = title.current?.value.trim();
		setEditing(false);
		if (save && value && value !== card.title) callbacks.onCardTitleEdit(card.id, value);
	};
	const image = cover && card.coverImage ? resolveVaultImage(app, card.coverImage) : '';
	const size: CardSize = card.size || 'M';
	return (
		<>
			{cover && (
				<div
					class={`dashboard-project-cover${image ? '' : ' dashboard-project-cover--default'}`}
					style={image ? { backgroundImage: `url("${image}")` } : undefined}
					draggable
				/>
			)}
			<div
				class="dashboard-card-header"
				draggable={!editing}
				onTouchStart={(event) => {
					const header = event.currentTarget;
					const active = header.classList.contains('dashboard-card-header--touched');
					header.ownerDocument
						.querySelectorAll('.dashboard-card-header--touched')
						.forEach((el) => el.classList.remove('dashboard-card-header--touched'));
					if (!active) header.classList.add('dashboard-card-header--touched');
				}}
			>
				<h4
					class="dashboard-card-title"
					style={{ cursor: 'pointer' }}
					onDblClick={(event) => {
						event.stopPropagation();
						setEditing(true);
					}}
				>
					{editing ? (
						<input
							ref={title}
							class="dashboard-title-edit-input"
							type="text"
							onKeyDown={(event) => {
								if (event.key === 'Enter' && !event.isComposing) {
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
						card.title
					)}
				</h4>
				<div class="dashboard-card-actions" onClick={(event) => event.stopPropagation()}>
					{widget && sectionType === 'dashboard' && (
						<button
							class="dashboard-card-btn dashboard-card-btn--size"
						aria-label={t('card.size')}
							onClick={() =>
								callbacks.onCardSizeChange(
									card.id,
									(['S', 'M', 'L'] as const)[(['S', 'M', 'L'].indexOf(size) + 1) % 3]!,
								)
							}
						>
							{t('widget.size' + size)}
						</button>
					)}
					{(widget || (kind === 'memo' && (card.type === 'generic' || card.type === 'note'))) && (
						<>
							<button
								class="dashboard-card-btn dashboard-card-btn--color"
								aria-label={t('renderer.setMemoColor')}
								style={{ color: card.color || undefined }}
								onClick={() => color.current?.click()}
							>
								<Icon name="palette" />
							</button>
							<input
								ref={color}
								type="color"
								value={card.color || '#f59e0b'}
								tabIndex={-1}
								aria-hidden="true"
								style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
								onChange={(event) => callbacks.onMemoColorChange(card, event.currentTarget.value)}
							/>
						</>
					)}
					{project && (sectionType === 'notes' || sectionType === 'projects') && (
						<button
							class="dashboard-card-btn dashboard-card-btn--newnote"
							aria-label={t('renderer.cardNewNote')}
							onClick={() => callbacks.onCardNewNote(card.id)}
						>
							<Icon name="file-plus" />
						</button>
					)}
					{kind !== 'memo' && kind !== 'task' && !(widget && sectionType === 'dashboard') && (
						<button
							class="dashboard-card-btn"
							aria-label={t('renderer.editCard')}
							onClick={() => callbacks.onCardEdit(card)}
						>
							<Icon name="pencil" />
						</button>
					)}
					{!widget && kind === 'memo' && (
						<button
							class="dashboard-card-btn"
							aria-label={t('renderer.saveMemoAsNote')}
							onClick={() => callbacks.onMemoSaveAsNote(card)}
						>
							<Icon name="file-down" />
						</button>
					)}
					{!widget && kind === 'task' && (
						<button
							class="dashboard-card-btn"
							aria-label={t('renderer.saveTasksToDaily')}
							onClick={() => callbacks.onTaskSaveToDaily(card)}
						>
							<Icon name="save" />
						</button>
					)}
					<button
						class="dashboard-card-btn dashboard-card-btn--danger"
						aria-label={t('renderer.deleteCard')}
						onClick={() => callbacks.onCardDelete(card.id)}
					>
						<Icon name="trash-2" />
					</button>
				</div>
			</div>
			<div
				class="dashboard-card-body"
				{...(project ? listDrop(context, callbacks, 'doc', card.id, card.docs.length) : {})}
			>
				{card.type === 'web' ? (
					<WebShortcutPanel {...props} />
				) : card.type === 'weather' ? (
					<WeatherPanel config={card.weatherConfig} root={root} />
				) : card.type === 'tracker' ? (
					<TrackerPanel card={card} app={app} context={context} />
				) : kind === 'memo' ? (
					<MemoPanel {...props} />
				) : kind === 'task' ? (
					<TaskPanel {...props} />
				) : (
					<ProjectPanel {...props} />
				)}
			</div>
			{card.dueDate && (
				<div class="dashboard-card-due">
					<span>{card.dueDate}</span>
				</div>
			)}
			{!widget && (
				<div
					class="dashboard-card-resize-handle"
					onMouseDown={(event) => {
						event.preventDefault();
						event.stopPropagation();
						cleanupResize.current?.();
						const doc = root.ownerDocument,
							x = event.clientX,
							width = root.offsetWidth;
						const next = (x2: number) => Math.max(200, Math.min(600, width + x2 - x));
						const move = (e: MouseEvent) => {
							const value = next(e.clientX);
							root.style.flex = `0 0 ${value}px`;
							root.style.minWidth = root.style.maxWidth = value + 'px';
						};
						const stop = () => {
							doc.removeEventListener('mousemove', move);
							doc.removeEventListener('mouseup', up);
							root.classList.remove('dashboard-card--resizing');
							cleanupResize.current = null;
						};
						const up = (e: MouseEvent) => {
							stop();
							const value = next(e.clientX);
							if (value !== card.width) callbacks.onCardWidthChange(card.id, value);
						};
						cleanupResize.current = stop;
						root.classList.add('dashboard-card--resizing');
						doc.addEventListener('mousemove', move);
						doc.addEventListener('mouseup', up);
					}}
				/>
			)}
		</>
	);
}
