// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/tab-group/TabGroupDropOverlay.tsx
import { useDroppable } from '@dnd-kit/core';
import { cn } from '../../../../ui/lib/utils';
import { useT } from '../../../../ui/react/hooks';
const positions = {
	left: 'inset-y-0 left-0 w-[30%]',
	right: 'inset-y-0 right-0 w-[30%]',
	up: 'top-0 left-[30%] right-[30%] h-[30%]',
	down: 'bottom-0 left-[30%] right-[30%] h-[30%]',
	center: 'inset-[30%]',
};
function Zone({ groupId, edge }: { groupId: string; edge: keyof typeof positions }) {
	const { setNodeRef, isOver } = useDroppable({
			id: `drop:${groupId}:${edge}`,
			data: { kind: 'zone', groupId, edge },
		}),
		t = useT();
	return (
		<div
			ref={setNodeRef}
			data-drop-zone={edge}
			aria-hidden="true"
			className={cn(
				'absolute border border-dashed border-ring/30',
				positions[edge],
				isOver ? 'bg-ring/20' : 'bg-ring/5',
			)}
		>
			<span className="pointer-events-none absolute bottom-2 left-2 rounded-sm px-1.5 py-0.5 text-xs font-medium">
				{isOver ? t(edge === 'center' ? 'agent.workspace.moveHere' : 'agent.workspace.newSplit') : ''}
			</span>
		</div>
	);
}
export function DropZones({ groupId }: { groupId: string }) {
	return (
		<div className="absolute inset-0 z-[var(--layer-popover)]">
			{(Object.keys(positions) as (keyof typeof positions)[]).map((edge) => (
				<Zone key={edge} groupId={groupId} edge={edge} />
			))}
		</div>
	);
}
