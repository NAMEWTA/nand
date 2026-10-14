// Adapted from shadcn/ui new-york-v4 (MIT), Copyright (c) 2023 shadcn.
// Source recipe: shadcn-ui/ui, apps/v4/registry/new-york-v4/ui/skeleton.tsx.
// Recipe adaptation (no upstream revision recorded); React 19 / Radix UI 1.6.7, resizable 3.0.6.
import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot="skeleton"
			className={cn('animate-pulse rounded-md bg-accent motion-reduce:animate-none', className)}
			{...props}
		/>
	);
}
