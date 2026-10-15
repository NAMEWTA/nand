// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/browser-pane/annotate/MarkupToolbar.tsx
import React from 'react';
import { ArrowUpRight, Circle, Highlighter, Pencil, Redo2, Square, Trash2, Type, Undo2 } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../../../ui/components/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../ui/components/popover';
import { cn } from '../../../../ui/lib/utils';
import { t } from '../../../../shared/i18n';
import { MARKUP_COLORS, MARKUP_FONT_SIZES, MARKUP_WIDTHS, type MarkupTool } from '../../core/markup-model';

type ToolItem = {
	kind: MarkupTool;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
};

function toolItems(): ToolItem[] {
	return [
		{
			kind: 'pen',
			icon: Pencil,
			label: t('browser.pen'),
		},
		{
			kind: 'highlight',
			icon: Highlighter,
			label: t('browser.highlight'),
		},
		{
			kind: 'arrow',
			icon: ArrowUpRight,
			label: t('browser.arrow'),
		},
		{
			kind: 'rect',
			icon: Square,
			label: t('browser.rect'),
		},
		{
			kind: 'ellipse',
			icon: Circle,
			label: t('browser.ellipse'),
		},
		{
			kind: 'text',
			icon: Type,
			label: t('browser.text'),
		},
	];
}

export type MarkupToolbarProps = {
	tool: MarkupTool;
	onToolChange: (tool: MarkupTool) => void;
	color: string;
	onColorChange: (color: string) => void;
	width: number;
	onWidthChange: (width: number) => void;
	fontSize: number;
	onFontSizeChange: (fontSize: number) => void;
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
	onClear: () => void;
};

export const MarkupToolbar = React.memo(function MarkupToolbar({
	tool,
	onToolChange,
	color,
	onColorChange,
	width,
	onWidthChange,
	fontSize,
	onFontSizeChange,
	canUndo,
	canRedo,
	onUndo,
	onRedo,
	onClear,
}: MarkupToolbarProps) {
	return (
		<TooltipProvider delayDuration={300}>
			<div className="flex flex-wrap items-center justify-center gap-1 rounded-md border border-border bg-card/95 px-1.5 py-1 shadow-md backdrop-blur">
				{toolItems().map((item) => (
					<IconButton
						key={item.kind}
						label={item.label}
						active={tool === item.kind}
						onClick={() => onToolChange(item.kind)}
					>
						<item.icon className="size-4" />
					</IconButton>
				))}

				<Divider />

				<Popover>
					<Tooltip>
						<TooltipTrigger asChild>
							<PopoverTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t('browser.markupStyle')}
								>
									<span
										className="size-4 rounded-full border border-border"
										style={{ backgroundColor: color }}
									/>
								</Button>
							</PopoverTrigger>
						</TooltipTrigger>
						<TooltipContent side="top" sideOffset={4}>
							{t('browser.markupStyle')}
						</TooltipContent>
					</Tooltip>
					<PopoverContent side="top" align="start" className="w-auto p-2">
						<div className="flex flex-wrap gap-1">
							{MARKUP_COLORS.map((swatch) => (
								<button
									key={swatch}
									type="button"
									aria-label={swatch}
									onClick={() => onColorChange(swatch)}
									className={cn(
										'size-6 rounded-full border',
										color === swatch ? 'border-ring ring-1 ring-ring' : 'border-border',
									)}
									style={{ backgroundColor: swatch }}
								/>
							))}
						</div>
						<div className="mt-2 flex items-center gap-1">
							{MARKUP_WIDTHS.map((option) => (
								<button
									key={option}
									type="button"
									aria-label={t('browser.markupWidthOption', { value: option })}
									onClick={() => onWidthChange(option)}
									className={cn(
										'flex h-6 flex-1 items-center justify-center rounded-sm border',
										width === option ? 'border-ring bg-accent' : 'border-border hover:bg-accent/50',
									)}
								>
									<span
										className="rounded-full bg-foreground"
										style={{ width: option + 2, height: option + 2 }}
									/>
								</button>
							))}
						</div>
					</PopoverContent>
				</Popover>

				<Popover>
					<Tooltip>
						<TooltipTrigger asChild>
							<PopoverTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-8 gap-1 px-2"
									aria-label={t('browser.markupFontSize')}
								>
									<Type className="size-3.5" />
									<span className="text-[11px] tabular-nums">{fontSize}</span>
								</Button>
							</PopoverTrigger>
						</TooltipTrigger>
						<TooltipContent side="top" sideOffset={4}>
							{t('browser.markupFontSize')}
						</TooltipContent>
					</Tooltip>
					<PopoverContent side="top" align="start" className="w-auto p-2">
						<div className="flex items-center gap-1">
							{MARKUP_FONT_SIZES.map((size) => (
								<button
									key={size}
									type="button"
									aria-label={t('browser.markupWidthOption', { value: size })}
									onClick={() => onFontSizeChange(size)}
									className={cn(
										'flex h-6 min-w-7 items-center justify-center rounded-sm border px-1 text-[11px] tabular-nums',
										fontSize === size
											? 'border-ring bg-accent'
											: 'border-border hover:bg-accent/50',
									)}
								>
									{size}
								</button>
							))}
						</div>
					</PopoverContent>
				</Popover>

				<Divider />

				<IconButton label={t('browser.undo')} disabled={!canUndo} onClick={onUndo}>
					<Undo2 className="size-4" />
				</IconButton>
				<IconButton label={t('browser.redo')} disabled={!canRedo} onClick={onRedo}>
					<Redo2 className="size-4" />
				</IconButton>
				<IconButton label={t('browser.clear')} disabled={!canUndo && !canRedo} onClick={onClear}>
					<Trash2 className="size-4" />
				</IconButton>
			</div>
		</TooltipProvider>
	);
});

function Divider(): React.JSX.Element {
	return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />;
}

type IconButtonProps = {
	label: string;
	active?: boolean;
	disabled?: boolean;
	onClick: () => void;
	children: React.ReactNode;
};

function IconButton({ label, active, disabled, onClick, children }: IconButtonProps): React.JSX.Element {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant={active ? 'default' : 'ghost'}
					size="icon-sm"
					disabled={disabled}
					aria-label={label}
					aria-pressed={active}
					onClick={onClick}
				>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="top" sideOffset={4}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}
