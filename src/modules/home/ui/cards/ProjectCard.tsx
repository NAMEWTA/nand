// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts
import { useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, Plus, GripVertical } from 'lucide-react';
import { useStore } from 'zustand';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { useT } from '../../../../ui/react/hooks';
import type { DashboardCard, DocNode } from '../../core/board/types/model';
import type { BoardStore } from '../../services/board-store';
import { useImage } from '../board/hooks';
import { IconButton, Choice } from '../board/controls';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { focalPosition } from '../../core/board/focal-point';
function DocRow({ store, card, node, path }: { store: BoardStore; card: string; node: DocNode; path: number[] }) {
	const t = useT(),
		{ setNodeRef, transform, attributes, listeners } = useSortable({
			id: `doc:${card}:${path.join('.')}`,
			data: { item: { kind: 'doc', card, path } },
		});
	return (
		<li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform) }}>
			<div className="flex items-center">
				<IconButton label={t('home.dashboard.drag')} {...attributes} {...listeners}>
					<GripVertical className="size-3" />
				</IconButton>
				<Button
					variant="ghost"
					className="h-7 min-w-0 flex-1 justify-start truncate px-1 text-xs"
					onClick={() => {
						void store.openFile(node.path);
					}}
				>
					<FileText className="size-3" />
					{node.path.split('/').pop()?.replace(/\.md$/, '')}
				</Button>
			</div>
			{node.children && (
				<ul className="ml-3">
					<DocRows store={store} card={card} nodes={node.children} parent={path} />
				</ul>
			)}
		</li>
	);
}
function DocRows({
	store,
	card,
	nodes,
	parent = [],
}: {
	store: BoardStore;
	card: string;
	nodes: DocNode[];
	parent?: number[];
}) {
	return (
		<SortableContext
			items={nodes.map((_, i) => `doc:${card}:${[...parent, i].join('.')}`)}
			strategy={verticalListSortingStrategy}
		>
			{nodes.map((node, i) => (
				<DocRow key={node.path + ':' + i} store={store} card={card} node={node} path={[...parent, i]} />
			))}
		</SortableContext>
	);
}
export function ProjectCard({ store, card }: { store: BoardStore; card: DashboardCard }) {
	const t = useT(),
		[search, setSearch] = useState(''),
		files = useStore(store.state, (s) => s.files),
		cover = useImage(store, card.coverImage);
	const column = useStore(store.state, (s) => s.data?.columns.find((c) => c.name === card.column)),
		[creating, setCreating] = useState(false),
		[template, setTemplate] = useState(
			column?.libraryConfig?.templatePaths?.[0] ?? column?.libraryConfig?.templatePath ?? '',
		);
	const create = () =>
		store
			.newNote(column?.libraryConfig?.folders?.[0] ?? '', search.trim() || t('home.dashboard.newNote'), template)
			.then((path) => store.sync.addDocToCard(card.id, path))
			.then(() => setCreating(false));

	return (
		<>
			{cover && column?.showCover !== false && (
				<img
					src={cover}
					alt=""
					className="-mx-4 mb-2 h-28 w-[calc(100%+32px)] max-w-none object-cover"
					style={{ objectPosition: focalPosition(card.coverPos) }}
				/>
			)}
			<ul className="m-0 min-h-0 list-none overflow-y-auto p-0">
				<DocRows store={store} card={card.id} nodes={card.docs} />
			</ul>
			<Input
				aria-label={t('home.dashboard.findNote')}
				placeholder={t('home.dashboard.findNote')}
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				className="mt-2 h-7 text-xs"
			/>
			{search && (
				<div className="max-h-28 overflow-y-auto">
					{files
						.filter((file) => file.basename.toLowerCase().includes(search.toLowerCase()))
						.slice(0, 20)
						.map((file) => (
							<Button
								key={file.path}
								variant="ghost"
								className="h-7 w-full justify-start text-xs"
								onClick={() => {
									void store.sync.addDocToCard(card.id, file.path).then(() => setSearch(''));
								}}
							>
								{file.basename}
							</Button>
						))}
				</div>
			)}
			<Button
				variant="ghost"
				size="xs"
				className="mt-2"
				onClick={() => {
					if ((column?.libraryConfig?.templatePaths?.length ?? 0) > 1) setCreating(true);
					else void create();
				}}
			>
				<Plus />
				{t('home.dashboard.newNote')}
			</Button>
			<div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
				<div className="h-full bg-primary" style={{ width: `${card.progress}%` }} />
			</div>
			{creating && (
				<DashboardDialog
					title={t('home.dashboard.newNote')}
					onClose={() => setCreating(false)}
					onSave={() => {
						void create();
					}}
				>
					<Choice
						value={template}
						label={t('home.dashboard.chooseTemplate')}
						onChange={setTemplate}
						options={(column?.libraryConfig?.templatePaths ?? []).map((value) => ({ value, label: value }))}
					/>
				</DashboardDialog>
			)}
		</>
	);
}
