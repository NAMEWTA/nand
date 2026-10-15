// Adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.; shadcn/ui (MIT).
// Original: src/renderer/src/components/ui/scroll-area.tsx
import * as React from 'react';
import * as ScrollAreaPrimitive from 'radix-ui/scroll-area';

import { cn } from '../lib/utils';

function ScrollArea({
	className,
	viewportClassName,
	viewportRef,
	viewportTabIndex,
	viewportProps,
	children,
	...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
	viewportClassName?: string;
	viewportRef?: React.Ref<HTMLDivElement>;
	/** Set e.g. -1 so the viewport can receive programmatic focus (explorer keyboard shortcuts after inline rename). */
	viewportTabIndex?: number;
	viewportProps?: React.ComponentProps<typeof ScrollAreaPrimitive.Viewport>;
}) {
	return (
		<ScrollAreaPrimitive.Root data-slot="scroll-area" className={cn('relative', className)} {...props}>
			<ScrollAreaPrimitive.Viewport
				ref={viewportRef}
				tabIndex={viewportTabIndex}
				data-slot="scroll-area-viewport"
				className={cn(
					'size-full pr-[var(--nd-hit-size)] rounded-[inherit] transition-[transform,opacity] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1',
					viewportClassName,
				)}
				{...viewportProps}
			>
				{children}
			</ScrollAreaPrimitive.Viewport>
			<ScrollBar />
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
}

function ScrollBar({
	className,
	orientation = 'vertical',
	...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
	return (
		<ScrollAreaPrimitive.ScrollAreaScrollbar
			data-slot="scroll-area-scrollbar"
			orientation={orientation}
			className={cn(
				'flex touch-none p-px transition-[transform,opacity] select-none bg-transparent',
				orientation === 'vertical' && 'h-full w-[var(--nd-hit-size)] py-2',
				orientation === 'horizontal' && 'h-[var(--nd-hit-size)] px-2 flex-col',
				className,
			)}
			{...props}
		>
			<ScrollAreaPrimitive.ScrollAreaThumb
				data-slot="scroll-area-thumb"
				data-orientation={orientation}
				className={cn(
					'relative flex-1 before:absolute before:rounded-full before:bg-muted-foreground/40 hover:before:bg-muted-foreground/60',
					orientation === 'vertical'
						? 'before:inset-y-0 before:right-0 before:w-[9px]'
						: 'before:inset-x-0 before:bottom-0 before:h-[9px]',
				)}
			/>
		</ScrollAreaPrimitive.ScrollAreaScrollbar>
	);
}

export { ScrollArea, ScrollBar };
