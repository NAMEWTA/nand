import { observeBoardAction } from '../board/actions';
// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts
import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2, ExternalLink, Pin, Save } from 'lucide-react';
import type { DashboardCard } from '../../core/board/types/model';
import type { BoardStore } from '../../services/board-store';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import { Textarea } from '../../../../ui/components/textarea';
import { useT } from '../../../../ui/react/hooks';
import { memoCardText } from '../../platform/board/card-move';
import { IconButton, Choice } from '../board/controls';
import { RenameTitle } from '../board/RenameTitle';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { MemoBody } from './MemoBody';
import { TaskList } from './TaskList';
import { ImagePosition } from '../banner/BannerEditDialog';
import { ProjectCard } from './ProjectCard';
export function Card({
	store,
	card,
	index,
	projects = false,
	immersive = false,
}: {
	store: BoardStore;
	card: DashboardCard;
	index: number;
	projects?: boolean;
	immersive?: boolean;
}) {
	const t = useT(),
		[edit, setEdit] = useState(false),
		[draft, setDraft] = useState(card),
		[remove, setRemove] = useState(false),
		[preview, setPreview] = useState(false);
	const { attributes, isDragging, listeners, setNodeRef, transform } = useSortable({
		disabled: immersive,
		id: `card:${card.id}`,
		data: { item: { kind: 'card', id: card.id, column: card.column, index } },
	});
	const project = projects || card.type === 'project',
		web = card.type === 'web',
		task = card.type === 'task';
	return (
		<article
			ref={setNodeRef}
			className={`dashboard-card group/card relative flex min-h-[200px] shrink-0 flex-col overflow-hidden rounded-[var(--db-radius-md)] border border-[var(--db-border-card)] bg-card p-4 shadow-[var(--db-shadow-card)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--db-bg-card-hover)] hover:shadow-[var(--db-shadow-card-hover)] motion-reduce:transform-none ${project ? 'w-[280px]' : 'w-[260px]'}`}
			style={{
				transform: CSS.Transform.toString(transform),
				opacity: isDragging ? 0.4 : undefined,
				rotate: isDragging ? '2deg' : undefined,
				borderTopColor: card.color || undefined,
				borderTopWidth: card.color ? 3 : undefined,
			}}
		>
			<div
				className="dashboard-card-header mb-1.5 flex shrink-0 items-center gap-1"
				onPointerDown={(event) => {
					if ((event.target as Element).closest('h4')) listeners?.onPointerDown?.(event);
				}}
			>
				<IconButton
					label={t('home.dashboard.drag')}
					className="absolute top-1 right-1 size-4 shrink-0 opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
					{...attributes}
					{...listeners}
				>
					<GripVertical className="size-3" />
				</IconButton>
				<h4 className="m-0 min-w-0 flex-1 text-[.875em] leading-[1.3] font-semibold">
					<RenameTitle
						immersive={immersive}
						value={card.title}
						onRename={(title) => store.sync.updateCard(card.id, { title })}
					/>
				</h4>
				<div className="absolute top-2 right-2 flex rounded bg-card opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
					{!project && (
						<IconButton
							label={t('home.dashboard.pinCard')}
							onClick={() => {
								void observeBoardAction(store.sync.moveCard(card.id, card.column, 0));
							}}
						>
							<Pin className="size-3" />
						</IconButton>
					)}
					{!project && !web && (
						<IconButton
							label={t(task ? 'home.dashboard.saveDaily' : 'home.dashboard.saveNote')}
							onClick={() => {
								void store.saveCard(card);
							}}
						>
							<Save className="size-3" />
						</IconButton>
					)}
					<IconButton
						label={t('common.edit')}
						onClick={() => {
							setDraft(structuredClone(card));
							setEdit(true);
						}}
					>
						<Pencil className="size-3" />
					</IconButton>
					<IconButton label={t('common.delete')} onClick={() => setRemove(true)}>
						<Trash2 className="size-3" />
					</IconButton>
				</div>
			</div>
			{project ? (
				<ProjectCard store={store} card={card} />
			) : task ? (
				<TaskList store={store} card={card} />
			) : web ? (
				<Button
					variant="ghost"
					className="h-auto justify-start whitespace-normal"
					onClick={() => {
						if (card.openIn === 'tab') void store.host.openBrowser({ url: card.url });
						else if (card.openIn === 'system') store.ownerWindow?.open(card.url, '_blank', 'noopener');
						else setPreview(true);
					}}
				>
					<ExternalLink />
					{card.url}
				</Button>
			) : (
				<MemoBody
					key={store.memoDraftKey(card.id)}
					store={store}
					text={memoCardText(card)}
					cardId={card.id}
					onSave={(text, original) => store.saveMemo(card.id, text, original)}
				/>
			)}
			{card.dueDate && (
				<div
					className={`mt-2 text-[.7em] ${card.dueDate < new Date().toISOString().slice(0, 10) ? 'text-destructive' : 'text-muted-foreground'}`}
				>
					{card.dueDate}
				</div>
			)}
			{edit && (
				<DashboardDialog
					title={t('common.edit')}
					onClose={() => setEdit(false)}
					onSave={() => {
						void observeBoardAction(store.sync.updateCard(card.id, draft).then(() => setEdit(false)));
					}}
				>
					<Label>
						{t('home.dashboard.name')}
						<Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
					</Label>
					{web ? (
						<>
							<Label>
								{t('home.dashboard.url')}
								<Input
									value={draft.url}
									onChange={(e) => setDraft({ ...draft, url: e.target.value })}
								/>
							</Label>
							<Choice
								label={t('home.dashboard.openIn')}
								value={draft.openIn ?? 'modal'}
								onChange={(openIn) =>
									setDraft({ ...draft, openIn: openIn as 'modal' | 'tab' | 'system' })
								}
								options={[
									{ value: 'modal', label: t('home.dashboard.modal') },
									{ value: 'system', label: t('home.dashboard.systemBrowser') },
									{ value: 'tab', label: t('home.dashboard.browserTab') },
								]}
							/>
						</>
					) : project ? (
						<>
							<ImagePosition
								store={store}
								path={draft.coverImage}
								raw={draft.coverPos}
								onChange={(x, y) => setDraft({ ...draft, coverPos: `${x},${y}` })}
							/>
							<Label>
								{t('home.dashboard.image')}
								<Input
									value={draft.coverImage}
									onChange={(e) => setDraft({ ...draft, coverImage: e.target.value })}
								/>
							</Label>
						</>
					) : (
						<Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
					)}
					{!project && !task && !web && (
						<Label>
							{t('renderer.setMemoColor')}
							<div className="flex gap-2">
								{['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'].map(
									(color, i) => (
										<Button
											key={color}
											variant="ghost"
											size="icon-xs"
											aria-label={t(`home.dashboard.color.${color}`)}
											style={{ backgroundColor: `var(--db-memo-${color})` }}
											onClick={() =>
												setDraft({
													...draft,
													color: [
														'#ef4444',
														'#f97316',
														'#eab308',
														'#22c55e',
														'#06b6d4',
														'#3b82f6',
														'#a855f7',
														'#ec4899',
													][i]!,
												})
											}
										/>
									),
								)}
							</div>
						</Label>
					)}
					<Input
						type="date"
						aria-label={t('home.dashboard.due')}
						value={draft.dueDate}
						onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
					/>
				</DashboardDialog>
			)}
			{preview && (
				<DashboardDialog wide title={card.title} onClose={() => setPreview(false)}>
					<iframe
						title={card.title}
						src={/^https?:\/\//i.test(card.url) ? card.url : undefined}
						sandbox="allow-scripts allow-forms allow-popups"
						className="h-[60vh] w-full border-0"
					/>
				</DashboardDialog>
			)}
			{remove && (
				<DashboardDialog title={t('common.delete')} onClose={() => setRemove(false)}>
					<p>{card.title}</p>
					<Button
						variant="destructive"
						onClick={() => {
							void observeBoardAction(store.sync.deleteCard(card.id));
						}}
					>
						{t('common.delete')}
					</Button>
				</DashboardDialog>
			)}
		</article>
	);
}
