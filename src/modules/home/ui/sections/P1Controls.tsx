// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/toolbar-dropdown.ts, src/library-section.ts
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from '../../../../ui/components/dropdown-menu';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { p1Classes } from '../theme/p1-classes';
import type { ComponentProps, KeyboardEventHandler } from 'react';
import type { ToolbarDropdownItem } from '../ui/toolbar-dropdown';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Textarea } from '../../../../ui/components/textarea';
import { Label } from '../../../../ui/components/label';
import { useT } from '../../../../ui/react/hooks';
export function ToolbarDropdown({
	currentKey,
	items,
	pick,
}: {
	currentKey: string;
	items: readonly ToolbarDropdownItem[];
	pick: (key: string) => void;
}) {
	const current = items.find((i) => i.key === currentKey);
	return (
		<IconChoice
			icon={current?.icon ?? 'maximize-2'}
			value={currentKey}
			label={current?.label ?? ''}
			options={items.map((i) => ({ value: i.key, label: i.label }))}
			onChange={pick}
		/>
	);
}
export function Pagination({ page, pages, change }: { page: number; pages: number; change: (page: number) => void }) {
	const t = useT();
	return (
		<div className="flex items-center justify-center gap-2">
			<Button
				variant="ghost"
				size="icon"
				aria-label={t('home.p1.previous')}
				disabled={page <= 1}
				onClick={() => change(page - 1)}
			>
				‹
			</Button>
			<span>
				{page} / {pages}
			</span>
			<Button
				variant="ghost"
				size="icon"
				aria-label={t('home.p1.next')}
				disabled={page >= pages}
				onClick={() => change(page + 1)}
			>
				›
			</Button>
		</div>
	);
}
export function TextField({
	label,
	hint,
	multiline,
	onInput,
	onKeyDown,
	...props
}: Omit<ComponentProps<typeof Input>, 'onInput' | 'onKeyDown'> & {
	label: string;
	hint?: string;
	multiline?: boolean;
	onInput: (value: string) => void;
	onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
}) {
	return (
		<Label className="grid gap-2">
			{label}
			{multiline ? (
				<Textarea value={props.value} disabled={props.disabled} onChange={(e) => onInput(e.target.value)} />
			) : (
				<Input {...props} onChange={(e) => onInput(e.target.value)} onKeyDown={onKeyDown} />
			)}{' '}
			{hint && <span className="text-xs text-muted-foreground">{hint}</span>}
		</Label>
	);
}

/** Upstream icon-only dropdown trigger; Radix owns selection and focus. */
export function IconChoice({
	icon,
	label,
	value,
	options,
	onChange,
}: {
	icon: string;
	label: string;
	value: string;
	options: readonly { value: string; label: string }[];
	onChange: (value: string) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon-xs"
					data-hit-control
					className={`${p1Classes('dashboard-toolbar-dropdown')} size-[26px]`}
					aria-label={label}
				>
					<ObsidianIcon name={icon} className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				{options.map((option) => (
					<DropdownMenuItem
						key={option.value}
						onSelect={() => onChange(option.value)}
						aria-selected={value === option.value}
					>
						{option.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
