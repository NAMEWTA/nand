import type { ReactNode } from 'react';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';

/** The title row shared by widgets that draw their own title: icon, name and optional actions on the right. */
export function WidgetHeader({ icon, title, actions }: { icon: string; title: string; actions?: ReactNode }) {
	return (
		<div className="mb-1 flex h-6 shrink-0 items-center gap-1.5 border-b border-[var(--db-border)] pb-0.5">
			<ObsidianIcon name={icon} className="size-3.5 text-[var(--db-text-muted)]" />
			<h3 className="m-0 min-w-0 flex-1 truncate text-[.72em] font-semibold tracking-[.05em] opacity-70">
				{title}
			</h3>
			{actions}
		</div>
	);
}
