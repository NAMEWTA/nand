// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts
import type { ComponentProps } from 'react';
import { Button } from '../../../../ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/components/tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../../../ui/components/select';
import { useDashboardLayout, useDashboardTheme } from '../theme/ThemeBridge';
export function IconButton({ label, ...props }: ComponentProps<typeof Button> & { label: string }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button variant="ghost" size="icon-xs" aria-label={label} {...props} />
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}
export function Choice({
	value,
	onChange,
	label,
	options,
	className,
}: {
	className?: string;
	value: string;
	onChange(this: void, value: string): void;
	label: string;
	options: readonly { value: string; label: string }[];
}) {
	const theme = useDashboardTheme(),
		layout = useDashboardLayout();
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger size="sm" aria-label={label} className={className ?? 'h-8 min-w-0 text-xs'}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent
				className="nand-dashboard-root"
				data-theme={theme}
				data-dashboard-layout={layout}
				data-dashboard-theme={theme}
			>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
