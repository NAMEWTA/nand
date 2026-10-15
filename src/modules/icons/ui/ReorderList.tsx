import type { ReactNode } from 'react';
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	SortableContext,
	useSortable,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { ActionButton } from '../../../ui/components/nand/ActionButton';
import { useT } from '../../../ui/react/hooks';
function Row({ id, children }: { id: string; children: ReactNode }) {
	const t = useT(),
		{ attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useSortable({ id });
	return (
		<div
			ref={setNodeRef}
			className="flex items-start gap-2 rounded-lg border border-border bg-card p-3"
			style={{ transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.5 : undefined }}
		>
			<ActionButton
				ref={setActivatorNodeRef}
				label={t('iconic.rulePicker.drag')}
				className="shrink-0 touch-none"
				{...attributes}
				{...listeners}
			>
				<GripVertical />
			</ActionButton>
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	);
}
export function ReorderList({
	rows,
	move,
}: {
	rows: Array<{ id: string; content: ReactNode }>;
	move: (from: number, to: number) => void;
}) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={({ active, over }) => {
				if (over && active.id !== over.id)
					move(
						rows.findIndex((r) => r.id === active.id),
						rows.findIndex((r) => r.id === over.id),
					);
			}}
		>
			<SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
				<div className="space-y-2">
					{rows.map((row) => (
						<Row key={row.id} id={row.id}>
							{row.content}
						</Row>
					))}
				</div>
			</SortableContext>
		</DndContext>
	);
}
