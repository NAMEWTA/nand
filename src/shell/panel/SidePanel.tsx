// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/sidebar/index.tsx
import { useId, useState, type Ref, type KeyboardEvent } from 'react';
import type { PanelItem, PanelModel, WorkbenchTarget } from '../../app/contracts/workbench';
import { t } from '../../shared/i18n';
import { Button } from '../../ui/components/button';
import { Input } from '../../ui/components/input';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from '../../ui/components/context-menu';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from '../../ui/components/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/components/tooltip';
import { cn } from '../../ui/lib/utils';
import { ShellIcon } from '../icon';
import { targetKey } from '../navigation-state';
import { useShellCloseAutoFocus } from '../interaction-lifetime';
export interface SidePanelProps {
	title: string;
	model?: PanelModel;
	current: WorkbenchTarget;
	customRef: Ref<HTMLDivElement>;
	onNavigate: (target: WorkbenchTarget) => void;
	onClose?: () => void;
	report: (error: unknown) => void;
}
export function SidePanel({ title, model, current, customRef, onNavigate, onClose, report }: SidePanelProps) {
	const closeAutoFocus = useShellCloseAutoFocus();
	const id = useId();
	const [query, setQuery] = useState('');
	const needle = query.trim().toLocaleLowerCase();
	const sections = (model?.sections ?? [])
		.map((s) => ({ ...s, items: s.items.filter((i) => !needle || i.label.toLocaleLowerCase().includes(needle)) }))
		.filter((s) => !needle || s.items.length);
	const open = (item: PanelItem) => {
		void Promise.resolve(item.select?.())
			.then(() => {
				if (item.target) onNavigate(item.target);
			})
			.catch(report);
	};
	const keys = (event: KeyboardEvent<HTMLButtonElement>) => {
		const rows = [
			...(event.currentTarget.closest('aside')?.querySelectorAll<HTMLButtonElement>('[data-panel-row]') ?? []),
		];
		const index = rows.indexOf(event.currentTarget);
		const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: rows.length - 1 }[event.key];
		if (next !== undefined && rows.length) {
			event.preventDefault();
			rows[(next + rows.length) % rows.length]?.focus();
		}
	};
	return (
		<aside
			data-shell-region="panel"
			tabIndex={-1}
			aria-labelledby={id}
			className="nand-panel flex h-full min-h-0 min-w-0 flex-col border-r border-sidebar-border bg-sidebar"
		>
			<header className="flex h-11 shrink-0 items-center gap-2 px-3">
				<h2 id={id} className="min-w-0 flex-1 truncate text-sm font-semibold">
					{title}
				</h2>
				{onClose && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={t('workbench.closeNavigation')}
								onClick={onClose}
							>
								<ShellIcon name="x" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>{t('workbench.closeNavigation')}</TooltipContent>
					</Tooltip>
				)}
			</header>
			{model?.primary && (
				<div className="px-3 pb-2">
					<Button
						variant="outline"
						size="sm"
						className="w-full justify-start"
						onClick={() => {
							void Promise.resolve(model.primary?.run()).catch(report);
						}}
					>
						<ShellIcon name={model.primary.icon} />
						{model.primary.label}
					</Button>
				</div>
			)}
			{model?.searchable && (
				<div className="px-3 pb-2">
					<Input
						className="h-8"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t('workbench.searchPanel')}
						aria-label={t('workbench.searchPanel')}
					/>
				</div>
			)}
			<div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek">
				{sections.map((section) => (
					<section key={section.id} aria-label={section.title}>
						{section.title && (
							<div className="px-3 pt-3 pb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
								{section.title}
							</div>
						)}
						{section.items.map((item) => {
							const active =
								item.active ?? (item.target ? targetKey(item.target) === targetKey(current) : false);
							const menu = item.menu?.() ?? [];
							return (
								<ContextMenu key={item.id}>
									<ContextMenuTrigger asChild>
										<div className="group mx-2 flex items-center rounded-md hover:bg-sidebar-accent">
											<Button
												data-panel-row
												data-current={active}
												variant="ghost"
												onKeyDown={keys}
												aria-current={active ? 'page' : undefined}
												className={cn(
													'h-8 min-w-0 flex-1 justify-start rounded-md px-2 text-[13px]',
													active && 'bg-sidebar-accent',
												)}
												onClick={() => open(item)}
											>
												{item.icon && (
													<ShellIcon name={item.icon} className="size-4 shrink-0" />
												)}
												<span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
												{item.meta && (
													<span className="max-w-24 truncate text-2xs text-muted-foreground">
														{item.meta}
													</span>
												)}
												{!!item.badge && (
													<span className="text-2xs tabular-nums">{item.badge}</span>
												)}
											</Button>
											{!!menu.length && (
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button
															variant="ghost"
															size="icon-xs"
															aria-label={t('workbench.more')}
															className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
														>
															<ShellIcon name="more-horizontal" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent onCloseAutoFocus={closeAutoFocus}>
														{menu.map((m, i) => (
															<DropdownMenuItem
																key={i}
																variant={m.danger ? 'destructive' : 'default'}
																onSelect={() => {
																	void Promise.resolve(m.run()).catch(report);
																}}
															>
																{m.title}
															</DropdownMenuItem>
														))}
													</DropdownMenuContent>
												</DropdownMenu>
											)}
										</div>
									</ContextMenuTrigger>
									{!!menu.length && (
										<ContextMenuContent onCloseAutoFocus={closeAutoFocus}>
											{menu.map((m, i) => (
												<ContextMenuItem
													key={i}
													variant={m.danger ? 'destructive' : 'default'}
													onSelect={() => {
														void Promise.resolve(m.run()).catch(report);
													}}
												>
													{m.title}
												</ContextMenuItem>
											))}
										</ContextMenuContent>
									)}
								</ContextMenu>
							);
						})}
						{!section.items.length && section.emptyText && (
							<p className="px-3 py-2 text-xs text-muted-foreground">{section.emptyText}</p>
						)}
					</section>
				))}
				{needle && !sections.length && (
					<p className="px-3 py-2 text-xs text-muted-foreground">{t('workbench.noResults')}</p>
				)}
				<div className="min-h-0 empty:hidden" ref={customRef} />
			</div>
		</aside>
	);
}
