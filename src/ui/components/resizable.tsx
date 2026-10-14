// Adapted from shadcn/ui new-york-v4 (MIT), Copyright (c) 2023 shadcn.
// Source recipe: shadcn-ui/ui, apps/v4/registry/new-york-v4/ui/resizable.tsx.
// Recipe adaptation (no upstream revision recorded); React 19 / Radix UI 1.6.7, resizable 3.0.6.
import type { ComponentProps } from 'react';
import { GripVerticalIcon } from 'lucide-react';
import * as ResizablePrimitive from 'react-resizable-panels';
import { cn } from '../lib/utils';
export function ResizablePanelGroup({ className, ...props }: ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
	return (
		<ResizablePrimitive.PanelGroup
			data-slot="resizable-panel-group"
			className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
			{...props}
		/>
	);
}
export function ResizablePanel(props: ComponentProps<typeof ResizablePrimitive.Panel>) {
	return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}
export function ResizableHandle({
	withHandle,
	className,
	...props
}: ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & { withHandle?: boolean }) {
	return (
		<ResizablePrimitive.PanelResizeHandle
			data-slot="resizable-handle"
			hitAreaMargins={{ fine: 0, coarse: 0 }}
			className={cn(
				'relative flex w-[var(--nd-hit-size)] items-center justify-center bg-transparent after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-[var(--nd-hit-size)] data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:inset-y-auto data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:top-1/2 data-[panel-group-direction=vertical]:after:h-px data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90',
				className,
			)}
			{...props}
		>
			{withHandle && (
				<div className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border">
					<GripVerticalIcon className="size-2.5" />
				</div>
			)}
		</ResizablePrimitive.PanelResizeHandle>
	);
}
