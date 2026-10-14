// Adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.; shadcn/ui (MIT).
// Original: src/renderer/src/components/ui/dialog.tsx
'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Minus, XIcon } from 'lucide-react';
import * as DialogPrimitive from 'radix-ui/dialog';

import { usePortalContainer } from '../react/contexts';
import { cn } from '../lib/utils';
import { handleImeOverlayEscape } from '../react/ime';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { useT } from '../react/hooks';

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
	return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
	return <DialogPrimitive.Portal container={usePortalContainer()} data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
	return (
		<DialogPrimitive.Overlay
			data-slot="dialog-overlay"
			// NAND semantic surface tokens follow the host theme and the optional Orca palette.
			className={cn(
				'fixed inset-0 z-[var(--layer-modal)] bg-black/55 md:backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
				className,
			)}
			{...props}
		/>
	);
}

const dialogContentSurfaceVariants = cva('', {
	variants: {
		surface: {
			default: '',
			/** The tinted, edge-to-edge panel of the two-column feature tip dialogs. */
			'feature-tip':
				'gap-0 bg-[color-mix(in_srgb,var(--foreground)_8%,var(--background))] p-0 dark:bg-[color-mix(in_srgb,var(--foreground)_16%,var(--background))]',
		},
	},
	defaultVariants: { surface: 'default' },
});

function DialogContentCloseButton({ variant }: { variant: 'close' | 'minimize' }) {
	const t = useT();
	const label = variant === 'minimize' ? t('ui.minimize') : t('ui.close');
	const button = (
		<DialogPrimitive.Close
			data-slot="dialog-close"
			data-hit-control
			className="nand-close-target absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
		>
			{variant === 'minimize' ? <Minus className="size-3.5" /> : <XIcon />}
			<span className="sr-only">{label}</span>
		</DialogPrimitive.Close>
	);
	return variant === 'minimize' ? (
		<Tooltip>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
			<TooltipContent side="top" sideOffset={4}>
				{label}
			</TooltipContent>
		</Tooltip>
	) : (
		button
	);
}

function DialogContent({
	className,
	children,
	overlayClassName,
	showCloseButton = true,
	closeButtonVariant = 'close',
	surface,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
	VariantProps<typeof dialogContentSurfaceVariants> & {
		overlayClassName?: string;
		showCloseButton?: boolean;
		closeButtonVariant?: 'close' | 'minimize';
	}) {
	return (
		<DialogPortal data-slot="dialog-portal">
			<DialogOverlay className={overlayClassName} />
			<DialogPrimitive.Content
				data-slot="dialog-content"
				// NAND semantic surface tokens follow the host theme and the optional Orca palette.
				className={cn(
					'fixed top-[50%] left-[50%] z-[var(--layer-modal)] grid w-full max-w-[calc(100%-2rem)] grid-cols-[minmax(0,1fr)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border border-border bg-background p-6 text-foreground shadow-floating md:backdrop-blur-2xl duration-[var(--anim-duration-fast)] outline-none    data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg',
					dialogContentSurfaceVariants({ surface }),
					className,
				)}
				{...props}
				onEscapeKeyDown={(event) => handleImeOverlayEscape(event, props.onEscapeKeyDown)}
			>
				{children}
				{showCloseButton && <DialogContentCloseButton variant={closeButtonVariant} />}
			</DialogPrimitive.Content>
		</DialogPortal>
	);
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="dialog-header"
			className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
			{...props}
		/>
	);
}

function DialogFooter({
	className,
	showCloseButton = false,
	children,
	...props
}: React.ComponentProps<'div'> & {
	showCloseButton?: boolean;
}) {
	const t = useT();
	return (
		<div
			data-slot="dialog-footer"
			className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
			{...props}
		>
			{children}
			{showCloseButton && (
				<DialogPrimitive.Close asChild>
					<Button variant="outline">{t('ui.close')}</Button>
				</DialogPrimitive.Close>
			)}
		</div>
	);
}

function DialogTitle({
	className,
	size = 'default',
	...props
}: React.ComponentProps<typeof DialogPrimitive.Title> & {
	/** `display` is the large headline of the two-column feature tip dialogs. */
	size?: 'default' | 'display';
}) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			data-size={size}
			className={cn(
				'text-lg leading-snug font-semibold break-words data-[size=display]:text-2xl data-[size=display]:leading-tight data-[size=display]:tracking-tight md:data-[size=display]:text-[1.75rem]',
				className,
			)}
			{...props}
		/>
	);
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn('text-sm text-muted-foreground', className)}
			{...props}
		/>
	);
}

export {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
};
