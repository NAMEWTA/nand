import type { KeyboardEvent } from 'react';
import type { WorkbenchFeature } from '../../app/contracts/workbench';
import { t } from '../../shared/i18n';
import { Button } from '../../ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/components/tooltip';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from '../../ui/components/context-menu';
import { cn } from '../../ui/lib/utils';
import { ShellIcon } from '../icon';
import { useShellCloseAutoFocus } from '../interaction-lifetime';
export interface RailItem {
	id: WorkbenchFeature;
	label: string;
	icon: string;
	slot: 'top' | 'bottom';
	badge?: number;
	failed?: boolean;
}
export interface RailProps {
	items: readonly RailItem[];
	current: WorkbenchFeature;
	panelOpen: boolean;
	onSelect: (id: WorkbenchFeature) => void;
	onOpen: (id: WorkbenchFeature, placement: 'tab' | 'split') => void;
}
export function Rail({ items, current, panelOpen, onSelect, onOpen }: RailProps) {
	const closeAutoFocus = useShellCloseAutoFocus();
	const ordered = [...items.filter((i) => i.slot === 'top'), ...items.filter((i) => i.slot === 'bottom')];
	const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
		const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: ordered.length - 1 }[event.key];
		if (next === undefined) return;
		event.preventDefault();
		const buttons = event.currentTarget.closest('nav')?.querySelectorAll<HTMLButtonElement>('[data-rail-button]');
		buttons?.[(next + ordered.length) % ordered.length]?.focus();
	};
	const button = (item: RailItem) => {
		const active = item.id === current;
		return (
			<ContextMenu key={item.id}>
				<Tooltip>
					<TooltipTrigger asChild>
						<ContextMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								data-rail-button
								data-feature={item.id}
								aria-label={item.label}
								aria-current={active ? 'page' : undefined}
								aria-expanded={active ? panelOpen : undefined}
								tabIndex={active ? 0 : -1}
								className={cn(
									'relative size-9 rounded-md hover:bg-sidebar-accent/70',
									active &&
										'bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:-left-2 before:inset-y-2 before:w-0.5 before:bg-foreground',
								)}
								onClick={() => onSelect(item.id)}
								onKeyDown={(e) => move(e, ordered.indexOf(item))}
							>
								<ShellIcon
									name={item.icon}
									className="size-[18px]"
									strokeWidth={active ? 2.25 : 1.75}
								/>
								{!!item.badge && (
									<span
										className="pointer-events-none absolute -right-1 top-0 h-4 min-w-4 rounded-full bg-destructive px-1 text-3xs text-destructive-foreground"
										aria-label={t('workbench.unreadCount', { count: item.badge })}
									>
										{item.badge > 99 ? '99+' : item.badge}
									</span>
								)}
								{item.failed && (
									<span className="absolute right-0 top-0 size-1.5 rounded-full bg-status-warning" />
								)}
							</Button>
						</ContextMenuTrigger>
					</TooltipTrigger>
					<TooltipContent side="right">
						{item.failed ? t('workbench.moduleFailed') : item.label}
					</TooltipContent>
				</Tooltip>
				<ContextMenuContent onCloseAutoFocus={closeAutoFocus}>
					<ContextMenuItem onSelect={() => onOpen(item.id, 'tab')}>
						{t('workbench.openStandalone')}
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => onOpen(item.id, 'split')}>
						{t('workbench.openSplit')}
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
		);
	};
	return (
		<nav
			data-shell-region="rail"
			tabIndex={-1}
			aria-label={t('workbench.navigation')}
			className="nand-rail flex w-[52px] shrink-0 flex-col items-center justify-between gap-2 border-r border-sidebar-border bg-sidebar py-2"
		>
			<div className="flex min-h-0 flex-col items-center gap-1 overflow-y-auto scrollbar-none">
				{ordered.filter((i) => i.slot === 'top').map(button)}
			</div>
			<div className="flex flex-col items-center gap-1">
				{ordered.filter((i) => i.slot === 'bottom').map(button)}
			</div>
		</nav>
	);
}
