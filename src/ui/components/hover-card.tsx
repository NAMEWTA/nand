// Adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.; shadcn/ui (MIT).
// Original: src/renderer/src/components/ui/hover-card.tsx
'use client';

import * as React from 'react';
import * as HoverCardPrimitive from 'radix-ui/hover-card';
import { cva, type VariantProps } from 'class-variance-authority';

import { usePortalContainer } from '../react/contexts';
import { cn } from '../lib/utils';

function HoverCard({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
	return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
	return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />;
}

const hoverCardContentVariants = cva('', {
	variants: {
		variant: {
			default: 'w-64 p-4',
			'workspace-details':
				'w-[360px] max-w-[calc(100vw-2rem)] max-h-[28rem] overflow-y-auto p-3 text-xs scrollbar-sleek',
		},
	},
	defaultVariants: { variant: 'default' },
});

function HoverCardContent({
	className,
	variant,
	align = 'center',
	sideOffset = 4,
	...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content> & VariantProps<typeof hoverCardContentVariants>) {
	return (
		<HoverCardPrimitive.Portal container={usePortalContainer()} data-slot="hover-card-portal">
			<HoverCardPrimitive.Content
				data-slot="hover-card-content"
				align={align}
				sideOffset={sideOffset}
				// NAND semantic surface tokens follow the host theme and the optional Orca palette.
				className={cn(
					'z-[var(--layer-menu)] origin-(--radix-hover-card-content-transform-origin) rounded-md border border-border bg-popover text-popover-foreground shadow-floating md:backdrop-blur-2xl outline-hidden    data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
					hoverCardContentVariants({ variant }),
					className,
				)}
				{...props}
			/>
		</HoverCardPrimitive.Portal>
	);
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
