// Adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.; shadcn/ui (MIT).
// Original: src/renderer/src/components/ui/command.tsx
'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Command as CommandPrimitive } from 'cmdk';
import { SearchIcon } from 'lucide-react';
import * as DialogPrimitive from 'radix-ui/dialog';

import { usePortalContainer } from '../react/contexts';
import { useT } from '../react/hooks';
import { cn } from '../lib/utils';
import { handleImeOverlayEscape } from '../react/ime';
import { useImeTextFieldProps } from '../react/ime';

const commandVariants = cva('flex h-full w-full flex-col overflow-hidden rounded-md', {
	variants: {
		surface: {
			default: 'bg-popover text-popover-foreground',
			inline: 'bg-transparent text-foreground',
		},
		density: {
			default: '',
			// Why: matches DropdownMenuItem type so a searchable picker reads like its sibling menus.
			menu: '[&_[cmdk-empty]]:text-[12px] [&_[cmdk-input-wrapper]_svg]:size-3.5 [&_[cmdk-input]]:h-8 [&_[cmdk-input]]:text-[12px] [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:py-[4px] [&_[cmdk-item]]:text-[12px] [&_[cmdk-item]]:leading-[17px] [&_[cmdk-item]]:font-[450]',
		},
	},
	defaultVariants: { surface: 'default', density: 'default' },
});

function Command({
	className,
	surface,
	density,
	...props
}: React.ComponentProps<typeof CommandPrimitive> & VariantProps<typeof commandVariants>) {
	return (
		<CommandPrimitive
			data-slot="command"
			className={cn(commandVariants({ surface, density }), className)}
			{...props}
		/>
	);
}

function CommandDialog({
	children,
	title,
	description,
	shouldFilter,
	onOpenAutoFocus,
	onCloseAutoFocus,
	contentClassName,
	overlayClassName,
	commandProps,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Root> & {
	title?: string;
	description?: string;
	shouldFilter?: boolean;
	onOpenAutoFocus?: (e: Event) => void;
	onCloseAutoFocus?: (e: Event) => void;
	contentClassName?: string;
	overlayClassName?: string;
	commandProps?: React.ComponentProps<typeof CommandPrimitive>;
}) {
	const t = useT();
	const { className: commandClassName, ...commandRootProps } = commandProps ?? {};

	return (
		<DialogPrimitive.Root {...props}>
			<DialogPrimitive.Portal container={usePortalContainer()}>
				<DialogPrimitive.Overlay
					// NAND semantic surface tokens follow the host theme and the optional Orca palette.
					className={cn(
						'fixed inset-0 z-[var(--layer-modal)] bg-black/55 md:backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
						overlayClassName,
					)}
				/>
				<DialogPrimitive.Content
					// NAND semantic surface tokens follow the host theme and the optional Orca palette.
					className={cn(
						'fixed top-[20%] left-[50%] z-[var(--layer-modal)] w-[660px] max-w-[90vw] translate-x-[-50%] rounded-lg border border-border bg-background text-foreground shadow-floating md:backdrop-blur-2xl outline-none    data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
						contentClassName,
					)}
					onEscapeKeyDown={(event) => handleImeOverlayEscape(event)}
					onOpenAutoFocus={onOpenAutoFocus}
					onCloseAutoFocus={onCloseAutoFocus}
				>
					<DialogPrimitive.Title className="sr-only">{title ?? t('ui.commandTitle')}</DialogPrimitive.Title>
					<DialogPrimitive.Description className="sr-only">
						{description ?? t('ui.commandDescription')}
					</DialogPrimitive.Description>
					<Command
						shouldFilter={shouldFilter}
						className={cn(
							'[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3',
							commandClassName,
						)}
						{...commandRootProps}
					>
						{children}
					</Command>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

const commandInputVariants = cva('flex items-center bg-muted/30 px-3 py-1', {
	variants: {
		variant: {
			default: 'border-b border-border',
			framed: 'rounded-md border border-input',
		},
	},
	defaultVariants: { variant: 'default' },
});

function CommandInput({
	className,
	variant,
	wrapperClassName,
	iconClassName,
	trailing,
	ref,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Input> &
	VariantProps<typeof commandInputVariants> & {
		wrapperClassName?: string;
		iconClassName?: string;
		/** Rendered after the field, inside the input frame (e.g. a filter control). */
		trailing?: React.ReactNode;
	}) {
	const imeProps = useImeTextFieldProps<HTMLInputElement>(props);
	return (
		<div className={cn(commandInputVariants({ variant }), wrapperClassName)} data-cmdk-input-wrapper="">
			<SearchIcon className={cn('mr-2 h-4 w-4 shrink-0 opacity-50', iconClassName)} />
			<CommandPrimitive.Input
				ref={ref}
				data-slot="command-input"
				className={cn(
					'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
					className,
				)}
				{...props}
				{...imeProps}
			/>
			{trailing}
		</div>
	);
}

function CommandList({
	className,
	animateHeight = false,
	ref,
	...props
}: React.ComponentProps<typeof CommandPrimitive.List> & {
	/** Size to cmdk’s filtered height; NAND does not animate layout properties. */
	animateHeight?: boolean;
}) {
	const internalRef = React.useRef<HTMLDivElement>(null);

	// Why: Radix Dialog applies react-remove-scroll which calls preventDefault()
	// on wheel events for portaled elements (e.g. Popover) outside the Dialog's
	// DOM tree. The scrollbar renders (CSS overflow works) but the browser never
	// scrolls because the native event is cancelled. A non-passive wheel listener
	// directly on the list takes over scrolling manually so it works regardless
	// of whether a scroll-lock is active.
	React.useEffect(() => {
		const el = internalRef.current;
		if (!el) {
			return;
		}
		const onWheel = (e: WheelEvent): void => {
			if (el.scrollHeight <= el.clientHeight) {
				return;
			}
			e.preventDefault();
			el.scrollTop += e.deltaY;
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	}, []);

	const mergedRef = React.useCallback(
		(node: HTMLDivElement | null) => {
			internalRef.current = node;
			if (typeof ref === 'function') {
				ref(node);
			} else if (ref) {
				ref.current = node;
			}
		},
		[ref],
	);

	return (
		<CommandPrimitive.List
			ref={mergedRef}
			data-slot="command-list"
			className={cn(
				'max-h-[min(400px,60vh)] overflow-y-auto overflow-x-hidden scrollbar-sleek scroll-pb-4 scroll-pt-4',
				animateHeight && 'h-[min(var(--cmdk-list-height),400px,60vh)]',
				className,
			)}
			{...props}
		/>
	);
}

function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot="command-empty"
			className={cn('py-6 text-center text-sm text-muted-foreground', className)}
			{...props}
		/>
	);
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot="command-group"
			className={cn(
				'overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground',
				className,
			)}
			{...props}
		/>
	);
}

const commandItemVariants = cva('', {
	variants: { selection: { default: '', palette: 'data-[selected=true]:text-foreground' } },
	defaultVariants: { selection: 'default' },
});

function CommandItem({
	className,
	selection,
	ref,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Item> & VariantProps<typeof commandItemVariants>) {
	return (
		<CommandPrimitive.Item
			ref={ref}
			data-slot="command-item"
			className={cn(
				'relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-[color-mix(in_srgb,var(--foreground)_12%,var(--background))] data-[selected=true]:ring-1 data-[selected=true]:ring-inset data-[selected=true]:ring-border data-[selected=true]:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
				commandItemVariants({ selection }),
				className,
			)}
			{...props}
		/>
	);
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator
			data-slot="command-separator"
			className={cn('-mx-1 h-px bg-border', className)}
			{...props}
		/>
	);
}

export { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator };
