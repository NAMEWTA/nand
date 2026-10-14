// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/automation-page-parts.tsx
import type { ComponentProps, ReactNode } from 'react';
import { useId } from 'react';
import { ChevronsUpDown, Check } from 'lucide-react';
import { Button } from '../../../ui/components/button';
import { Label } from '../../../ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/components/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ui/components/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '../../../ui/components/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '../../../ui/components/command';
import { useTransient } from './use-transient';
import { useT } from '../../../ui/react/hooks';

export function VisibleTooltip(props: ComponentProps<typeof Tooltip>) {
	const layer = useTransient();
	return <Tooltip {...props} open={layer.open} onOpenChange={layer.onOpenChange} />;
}
export function IconButton({ label, children, ...props }: ComponentProps<typeof Button> & { label: string }) {
	const layer = useTransient();
	return (
		<VisibleTooltip>
			<TooltipTrigger asChild>
				<Button type="button" variant="ghost" size="icon-sm" aria-label={label} {...props}>
					{children}
				</Button>
			</TooltipTrigger>
			{layer.visible && <TooltipContent>{label}</TooltipContent>}
		</VisibleTooltip>
	);
}
export function Field({
	label,
	children,
	help,
	error,
}: {
	label: string;
	children: (id: string) => ReactNode;
	help?: string;
	error?: string;
}) {
	const id = useId();
	return (
		<div className="space-y-2">
			<Label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
				{label}
			</Label>
			{children(id)}
			{error && (
				<p id={`${id}-error`} role="status" className="text-xs text-destructive">
					{error}
				</p>
			)}
			{help && <p className="text-xs text-muted-foreground">{help}</p>}
		</div>
	);
}
export function Choice({
	id,
	label,
	value,
	options,
	onChange,
	disabled,
}: {
	id?: string;
	label: string;
	value: string;
	options: readonly { value: string; label: string }[];
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	const layer = useTransient();
	return (
		<Select
			open={layer.open}
			onOpenChange={layer.onOpenChange}
			value={value}
			onValueChange={onChange}
			disabled={disabled}
		>
			<SelectTrigger
				id={id}
				aria-label={label}
				className="h-9 w-full min-w-0 border-input bg-input/30 shadow-xs hover:bg-accent/60 dark:bg-input/30 dark:hover:bg-input/50"
			>
				<SelectValue />
			</SelectTrigger>
			{layer.visible && (
				<SelectContent onCloseAutoFocus={layer.onCloseAutoFocus}>
					{options.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.label}
						</SelectItem>
					))}
				</SelectContent>
			)}
		</Select>
	);
}
export function SearchChoice({
	id,
	label,
	value,
	options,
	onChange,
	disabled,
	clearable,
}: {
	id?: string;
	label: string;
	value: string;
	options: readonly { value: string; label: string; icon?: ReactNode }[];
	onChange: (value: string) => void;
	disabled?: boolean;
	clearable?: boolean;
}) {
	const layer = useTransient(),
		t = useT();
	return (
		<Popover open={layer.open} onOpenChange={layer.onOpenChange}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					variant="outline"
					role="combobox"
					aria-expanded={layer.open}
					aria-label={label}
					disabled={disabled}
					className="h-9 w-full min-w-0 justify-between border-input bg-input/30 shadow-xs hover:bg-accent/60 dark:bg-input/30 dark:hover:bg-input/50"
				>
					<span className="flex min-w-0 items-center gap-2 truncate">
						{options.find((item) => item.value === value)?.icon}
						{options.find((item) => item.value === value)?.label || value || t('automation.select')}
					</span>
					<ChevronsUpDown className="size-3.5 shrink-0" />
				</Button>
			</PopoverTrigger>
			{layer.visible && (
				<PopoverContent onCloseAutoFocus={layer.onCloseAutoFocus} className="w-80 max-w-[calc(100vw-2rem)] p-0">
					<Command>
						<CommandInput aria-label={label} placeholder={t('ui.search')} />
						<CommandList>
							<CommandEmpty>{t('ui.noResults')}</CommandEmpty>
							{options.map((item) => (
								<CommandItem
									key={item.value}
									value={`${item.label} ${item.value}`}
									onSelect={() => {
										onChange(clearable && item.value === value ? '' : item.value);
										layer.onOpenChange(false);
									}}
								>
									{item.icon}
									<span className="truncate">{item.label}</span>
									{value === item.value && <Check className="ml-auto size-4" />}
								</CommandItem>
							))}
						</CommandList>
					</Command>
				</PopoverContent>
			)}
		</Popover>
	);
}
