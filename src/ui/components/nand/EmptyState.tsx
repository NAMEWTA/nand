import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
export function EmptyState({
	icon,
	title,
	description,
	action,
	className,
}: {
	icon?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div
			data-slot="empty-state"
			className={cn('flex flex-col items-center justify-center gap-3 p-8 text-center', className)}
		>
			<div className="text-muted-foreground [&_svg]:size-7">{icon}</div>
			<h3 className="text-base font-semibold">{title}</h3>
			{description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
			{action}
		</div>
	);
}
