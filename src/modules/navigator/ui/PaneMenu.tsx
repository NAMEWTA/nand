// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import type { ReactNode } from 'react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '../../../ui/components/context-menu';
import { cn } from '../../../ui/lib/utils';
import type { MenuEntry } from './menus';

/**
 * One context menu for a whole pane: rows set `entries` in their `contextmenu` handler, which runs
 * before the trigger opens the menu, so the menu always shows the row that was clicked.
 */
export function PaneMenu({ entries, children, className }: { entries: readonly MenuEntry[]; children: ReactNode; className?: string }) {
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div className={cn('min-h-0 flex-1', className)}>{children}</div>
			</ContextMenuTrigger>
			<ContextMenuContent className="min-w-44">
				{entries.map((entry) => (
					<span key={entry.id} className="contents">
						{entry.separatorBefore && <ContextMenuSeparator />}
						<ContextMenuItem disabled={entry.disabled} variant={entry.danger ? 'destructive' : 'default'} onSelect={() => { void Promise.resolve(entry.run()); }}>
							{entry.icon && <entry.icon aria-hidden />}
							{entry.label}
						</ContextMenuItem>
					</span>
				))}
			</ContextMenuContent>
		</ContextMenu>
	);
}
