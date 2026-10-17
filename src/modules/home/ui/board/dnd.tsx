// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/dnd.ts, src/drag-guard.ts
import type { ReactNode } from 'react';
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent,
	type CollisionDetection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { BoardStore } from '../../services/board-store';
export type DragItem =
	| { kind: 'section'; index: number }
	| { kind: 'card'; id: string; column: string; index: number }
	| { kind: 'task' | 'doc'; card: string; path: number[] };
export async function commitDrop(
	store: BoardStore,
	source: DragItem,
	target: DragItem,
	mode: 'before' | 'after' | 'nest' = 'before',
): Promise<void> {
	if (source.kind === 'section' && target.kind === 'section') await store.sync.moveColumn(source.index, target.index);
	if (source.kind === 'card' && target.kind === 'card' && source.id !== target.id)
		await store.sync.moveCard(source.id, target.column, target.index);
	if (source.kind === 'card' && target.kind === 'section') {
		const column = store.state.getState().data?.columns[target.index];
		if (
			column &&
			['sticky', 'memo', 'todo', 'projects', 'notes'].includes(column.sectionType ?? column.name.toLowerCase())
		)
			await store.sync.moveCard(source.id, column.name, column.cards.length);
	}
	if ((source.kind === 'task' || source.kind === 'doc') && source.kind === target.kind) {
		const path = [...target.path];
		if (source.card === target.card) {
			// Sync's cross-card methods receive coordinates after removal. A same-card
			// drop must relocate the target and never remove an ancestor into its child.
			if (source.path.every((part, i) => path[i] === part)) return;
			const depth = source.path.length - 1;
			if (
				path.length > depth &&
				source.path.slice(0, depth).every((part, i) => path[i] === part) &&
				path[depth]! > source.path[depth]!
			)
				path[depth]!--;
		}
		if (source.kind === 'task') await store.sync.moveTaskToCard(source.card, source.path, target.card, path, mode);
		else await store.sync.moveDocToCard(source.card, source.path, target.card, path, mode);
	}
	if ((source.kind === 'task' || source.kind === 'doc') && target.kind === 'card') {
		const card = store.state
			.getState()
			.data?.columns.flatMap((column) => column.cards)
			.find((card) => card.id === target.id);
		if (card && source.card !== card.id) {
			if (source.kind === 'task')
				await store.sync.moveTaskToCard(source.card, source.path, card.id, [card.tasks.length], 'before');
			else await store.sync.moveDocToCard(source.card, source.path, card.id, [card.docs.length], 'before');
		}
	}
}
const collision: CollisionDetection = (args) => {
	const kind = (args.active.data.current?.item as DragItem | undefined)?.kind;
	const candidates = args.droppableContainers.filter((container) => {
		const target = (container.data.current?.item as DragItem | undefined)?.kind;
		return (
			target === kind ||
			(kind === 'card' && target === 'section') ||
			((kind === 'doc' || kind === 'task') && target === 'card')
		);
	});
	const matches = closestCenter({ ...args, droppableContainers: candidates });
	if (kind !== 'card') return matches;
	const card = matches.find(
		(match) =>
			(candidates.find((c) => c.id === match.id)?.data.current?.item as DragItem | undefined)?.kind === 'card',
	);
	return card && card.data?.value < (matches[0]?.data?.value ?? Infinity) + 30 ? [card] : matches;
};
export function BoardDnd({ store, children }: { store: BoardStore; children: ReactNode }) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const end = (event: DragEndEvent) => {
		if (!event.over || event.active.id === event.over.id) return;
		const source = event.active.data.current?.item as DragItem | undefined,
			target = event.over.data.current?.item as DragItem | undefined;
		if (source && target)
			void commitDrop(
				store,
				source,
				target,
				event.delta.x > 35 ? 'nest' : event.delta.y > 0 ? 'after' : 'before',
			);
	};
	return (
		<DndContext sensors={sensors} collisionDetection={collision} onDragEnd={end}>
			{children}
		</DndContext>
	);
}
