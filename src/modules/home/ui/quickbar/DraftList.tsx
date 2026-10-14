// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), src/quick-note-config-modal.ts
import type { ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import {
	SortableContext,
	useSortable,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
	arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useT } from '../../../../ui/react/hooks';
import { IconButton } from '../board/controls';
function Row({ id, children }: { id: string; children: ReactNode }) {
	const t = useT(),
		{ attributes, listeners, setNodeRef, transform } = useSortable({ id });
	return (
		<div
			ref={setNodeRef}
			className="flex min-w-0 items-start gap-1"
			style={{ transform: CSS.Transform.toString(transform) }}
		>
			<IconButton label={t('home.dashboard.drag')} {...attributes} {...listeners}>
				<GripVertical />
			</IconButton>
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	);
}
export function DraftList<T extends { id: string }>({
	items,
	onChange,
	children,
}: {
	items: T[];
	onChange(this: void, items: T[], from: number, to: number): void;
	children(this: void, item: T, index: number): ReactNode;
}) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={({ active, over }) => {
				if (over && active.id !== over.id) {
					const from = items.findIndex((v) => v.id === active.id);
					const to = items.findIndex((v) => v.id === over.id);
					if (from >= 0 && to >= 0) onChange(arrayMove(items, from, to), from, to);
				}
			}}
		>
			<SortableContext items={items.map((v) => v.id)} strategy={verticalListSortingStrategy}>
				<div className="grid gap-2">
					{items.map((item, i) => (
						<Row id={item.id} key={item.id}>
							{children(item, i)}
						</Row>
					))}
				</div>
			</SortableContext>
		</DndContext>
	);
}
