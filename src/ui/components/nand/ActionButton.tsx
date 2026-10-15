import type { ComponentProps, ReactNode } from 'react';
import { Button } from '../button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';

export function ActionButton({
	label,
	children,
	...props
}: Omit<ComponentProps<typeof Button>, 'children'> & { label: string; children: ReactNode }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button variant="ghost" size="icon" {...props} aria-label={label}>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}
