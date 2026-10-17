// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts
import { observeBoardAction } from '../board/actions';
import { P2_SECTIONS, P1_SECTIONS } from './registry';
import { RssSection } from '../rss/RssSection';
import { TickTickSection } from '../ticktick/TickTickSection';
import { WereadSection } from '../weread/WereadSection';
import { P1Section } from './P1Section';
import { ProjectSection } from '../pm/ProjectSection';
import { SkillsSection } from '../skills/SkillsSection';
import { useRef, useState, type CSSProperties } from 'react';
import { useStore } from 'zustand';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Archive, ChevronDown, Columns2, GripVertical, Plus, Trash2, Settings } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import type { DashboardColumn } from '../../core/board/types/model';
import { partnerIndexOf } from '../../core/board/column-pairs';
import type { BoardStore } from '../../services/board-store';
import { IconButton } from '../board/controls';
import { RenameTitle } from '../board/RenameTitle';
import { ResizeHandle } from '../board/ResizeHandle';
import { Card } from '../cards/Card';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { SectionOptions } from './SectionOptions';
import { LibrarySection } from './types/LibrarySection';
export const sectionId = (column: DashboardColumn) => `section:${column.id ?? column.name}`;
export function Section({
	store,
	column,
	index,
	mobile,
	immersive = false,
}: {
	store: BoardStore;
	column: DashboardColumn;
	index: number;
	mobile: boolean;
	immersive?: boolean;
}) {
	const t = useT(),
		settings = useStore(store.state, (s) => s.settings),
		columns = useStore(store.state, (s) => s.data!.columns),
		[actions, setActions] = useState<HTMLDivElement | null>(null),
		[adding, setAdding] = useState(false),
		[options, setOptions] = useState(false),
		[remove, setRemove] = useState(false),
		[archive, setArchive] = useState(false),
		[archiving, setArchiving] = useState(false),
		[archiveError, setArchiveError] = useState(''),
		[height, setHeight] = useState<number | undefined>(),
		[width, setWidth] = useState<number | undefined>(),
		ref = useRef<HTMLElement | null>(null);
	const collapsed = !immersive && settings.collapsedSections.includes(column.id ?? column.name),
		type = column.sectionType ?? column.name.toLowerCase(),
		library = type === 'library' || type === 'folder',
		p1 = P1_SECTIONS.includes(type),
		p2 = P2_SECTIONS.includes(type),
		partner = partnerIndexOf(columns, index),
		left = partner === index + 1;
	const baseWidth = left ? (column.width ?? 50) : partner >= 0 ? 100 - (columns[partner]?.width ?? 50) : 100;
	const { attributes, isDragging, isOver, listeners, setNodeRef, transform } = useSortable({
		id: sectionId(column),
		disabled: immersive,
		data: { item: { kind: 'section', index } },
	});
	return (
		<section
			ref={(el) => {
				setNodeRef(el);
				ref.current = el;
			}}
			data-column={column.name}
			data-section-type={type}
			className={`dashboard-section-row group/section relative flex min-w-0 shrink-0 flex-col rounded-[var(--db-radius-lg)] ${immersive ? 'h-full border-0 bg-transparent px-[14px] py-[12px]' : 'border border-[var(--db-border-section)] bg-[var(--db-bg-section)] px-4 py-3'} ${column.half && !mobile ? 'dashboard-section-row--half' : 'basis-full'}`}
			style={
				{
					transform: CSS.Transform.toString(transform),
					opacity: isDragging ? 0.4 : undefined,
					outline: isOver ? '1px solid var(--db-accent)' : undefined,
					height:
						collapsed || mobile || p2 || type === 'skills' || type === 'pm'
							? undefined
							: (height ?? column.height),
					maxHeight: collapsed || mobile ? undefined : (height ?? column.height ?? (library ? 800 : 500)),
					'--dashboard-pair-width': `${width ?? baseWidth}%`,
					flexGrow: column.half ? 1 : undefined,
				} as CSSProperties
			}
		>
			<div className="dashboard-section-header mb-2 flex h-[var(--input-height,30px)] shrink-0 items-center gap-1">
				<IconButton
					label={t('home.dashboard.drag')}
					className={mobile ? 'hidden' : 'size-5'}
					{...attributes}
					{...listeners}
				>
					<GripVertical className="size-3" />
				</IconButton>
				<h3 className="m-0 min-w-0 text-[1em] font-bold">
					<RenameTitle
						immersive={immersive}
						value={column.name}
						onRename={(value) => store.sync.renameColumn(column.name, value, index)}
					/>
				</h3>
				<IconButton
					hidden={immersive}
					label={t('home.dashboard.collapse')}
					aria-expanded={!collapsed}
					className="size-5"
					onClick={() => {
						void store.settings((s) => {
							const key = column.id ?? column.name;
							s.collapsedSections = collapsed
								? s.collapsedSections.filter((v) => v !== key)
								: [...s.collapsedSections, key];
						});
					}}
				>
					<ChevronDown className={`size-3 ${collapsed ? '-rotate-90' : ''}`} />
				</IconButton>
				<div className="ml-auto flex gap-0.5 opacity-0 group-hover/section:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
					{(p1 || p2) && <div ref={setActions} className="flex items-center gap-1" />}
					{!library && !p1 && !p2 && (
						<>
							<IconButton
								label={t('home.dashboard.archiveTasks')}
								onClick={() => {
									setArchiveError('');
									setArchive(true);
								}}
							>
								<Archive className="size-3" />
							</IconButton>
							<IconButton label={t('home.dashboard.settings')} onClick={() => setOptions(true)}>
								<Settings className="size-3" />
							</IconButton>
							<IconButton label={t('home.dashboard.newCard')} onClick={() => setAdding(true)}>
								<Plus className="size-3" />
							</IconButton>
						</>
					)}
					{!mobile && (column.half || index < columns.length - 1) && (
						<IconButton
							label={t('home.dashboard.half')}
							aria-pressed={!!column.half}
							onClick={() => {
								void observeBoardAction(
									column.half
										? store.sync.moveColumn(index, index)
										: store.sync.moveColumnBeside(index, index + 1, 'left'),
								);
							}}
						>
							<Columns2 className="size-3" />
						</IconButton>
					)}
					<IconButton label={t('common.delete')} onClick={() => setRemove(true)}>
						<Trash2 className="size-3" />
					</IconButton>
				</div>
			</div>
			{!collapsed && (
				<>
					{type === 'rss' ? (
						<RssSection store={store} column={column} actions={actions} />
					) : type === 'ticktick' ? (
						<TickTickSection store={store} column={column} actions={actions} />
					) : type === 'weread' ? (
						<WereadSection store={store} column={column} actions={actions} />
					) : type === 'pm' ? (
						<ProjectSection store={store} column={column} actions={actions} />
					) : type === 'skills' ? (
						<SkillsSection store={store} column={column} actions={actions} />
					) : p1 ? (
						<P1Section store={store} column={column} actions={actions} />
					) : library ? (
						<LibrarySection store={store} column={column} />
					) : (
						<div className="dashboard-section-cards flex min-h-0 flex-1 gap-3 overflow-x-auto">
							<SortableContext
								items={column.cards.map((card) => `card:${card.id}`)}
								strategy={horizontalListSortingStrategy}
							>
								{column.cards.map((card, i) => (
									<Card
										key={card.id}
										store={store}
										card={card}
										index={i}
										projects={type === 'projects' || type === 'notes'}
									/>
								))}
							</SortableContext>
						</div>
					)}
					{!mobile && (
						<ResizeHandle
							label={t('home.dashboard.resizeHeight')}
							value={() => height ?? column.height ?? ref.current?.getBoundingClientRect().height ?? 260}
							min={120}
							max={1600}
							axis="y"
							className="mt-0.5 h-2 w-full cursor-ns-resize rounded-none border-b-2 border-transparent hover:border-primary"
							onPreview={setHeight}
							onCommit={(value) => {
								void observeBoardAction(store.sync.updateColumnHeight(column.name, value));
							}}
						/>
					)}
				</>
			)}
			{left && !mobile && !collapsed && (
				<ResizeHandle
					label={t('home.dashboard.resizeWidth')}
					value={width ?? baseWidth}
					min={20}
					max={80}
					axis="x"
					scale={() => 100 / (ref.current?.parentElement?.clientWidth || 1000)}
					className="absolute top-0 -right-2.5 bottom-0 z-[var(--layer-content)] h-full w-2.5 cursor-col-resize rounded-none hover:bg-primary/20"
					onPreview={(value) => {
						setWidth(value);
						const next = ref.current?.nextElementSibling;
						if (next?.instanceOf(HTMLElement)) next.style.flexBasis = `calc(${100 - value}% - 5.5px)`;
					}}
					onCommit={(value) => {
						void observeBoardAction(store.sync.updateColumnWidth(column.name, value));
					}}
				/>
			)}
			{options && <SectionOptions store={store} column={column} onClose={() => setOptions(false)} />}
			{adding && (
				<DashboardDialog title={t('home.dashboard.newCard')} onClose={() => setAdding(false)}>
					<div className="grid grid-cols-3 gap-2">
						{(type === 'projects' || type === 'notes' ? ['project'] : ['generic', 'task', 'web']).map(
							(kind) => (
								<Button
									key={kind}
									variant="outline"
									className="h-20"
									onClick={() => {
										void observeBoardAction(
											store.sync
												.addCard(column.name, {
													type: kind as 'generic' | 'task' | 'web' | 'project',
												})
												.then(() => setAdding(false)),
										);
									}}
								>
									{t(`home.dashboard.card.${kind}`)}
								</Button>
							),
						)}
					</div>
				</DashboardDialog>
			)}
			{archive && (
				<DashboardDialog
					title={t('home.dashboard.archiveTasks')}
					onClose={() => {
						if (!archiving) setArchive(false);
					}}
				>
					<p>
						{store.completedTasks(column.name).length
							? t('notice.archiveConfirm', { count: store.completedTasks(column.name).length })
							: t('notice.archiveEmpty')}
					</p>
					{archiveError && (
						<p role="alert" className="text-destructive">
							{archiveError}
						</p>
					)}
					<Button
						disabled={archiving || !store.completedTasks(column.name).length}
						onClick={() => {
							setArchiving(true);
							void store
								.archiveTasks(column.name)
								.then(() => setArchive(false))
								.catch((error: unknown) =>
									setArchiveError(error instanceof Error ? error.message : t('notice.archiveError')),
								)
								.finally(() => setArchiving(false));
						}}
					>
						{t('home.dashboard.archiveTasks')}
					</Button>
				</DashboardDialog>
			)}
			{remove && (
				<DashboardDialog title={t('common.delete')} onClose={() => setRemove(false)}>
					<p>{column.name}</p>
					<Button
						variant="destructive"
						onClick={() => {
							void observeBoardAction(store.sync.deleteColumn(column.name, index));
						}}
					>
						{t('common.delete')}
					</Button>
				</DashboardDialog>
			)}
		</section>
	);
}
