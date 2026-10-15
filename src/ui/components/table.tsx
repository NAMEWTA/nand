// Adapted from shadcn/ui new-york-v4 (MIT), Copyright (c) 2023 shadcn.
// Source recipe: shadcn-ui/ui, apps/v4/registry/new-york-v4/ui/table.tsx.
// Recipe adaptation (no upstream revision recorded); React 19 / Radix UI 1.6.7, resizable 3.0.6.
import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';
export function Table({ className, ...props }: ComponentProps<'table'>) {
	return (
		<div data-slot="table-container" className="relative w-full overflow-x-auto scrollbar-sleek">
			<table data-slot="table" className={cn('w-full caption-bottom text-sm', className)} {...props} />
		</div>
	);
}
export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
	return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />;
}
export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
	return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}
export function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
	return (
		<tfoot
			data-slot="table-footer"
			className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
			{...props}
		/>
	);
}
export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
	return (
		<tr
			data-slot="table-row"
			className={cn('border-b transition-[transform,opacity] hover:bg-muted/50 data-[state=selected]:bg-muted', className)}
			{...props}
		/>
	);
}
export function TableHead({ className, ...props }: ComponentProps<'th'>) {
	return (
		<th
			data-slot="table-head"
			className={cn(
				'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
				className,
			)}
			{...props}
		/>
	);
}
export function TableCell({ className, ...props }: ComponentProps<'td'>) {
	return (
		<td
			data-slot="table-cell"
			className={cn(
				'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
				className,
			)}
			{...props}
		/>
	);
}
export function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
	return (
		<caption data-slot="table-caption" className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
	);
}
