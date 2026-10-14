import { VisibleTooltip as Tooltip } from '../parts';
import { useTransient } from '../use-transient';
// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationListLocalRow.tsx
import {
	MoreHorizontal,
	Pause,
	Pencil,
	Play,
	Trash2,
	Bot,
	Terminal,
	Bell,
	CheckSquare,
	File,
	Globe,
	Command,
} from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Badge } from '../../../../ui/components/badge';
import { Switch } from '../../../../ui/components/switch';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from '../../../../ui/components/dropdown-menu';
import { TooltipTrigger, TooltipContent } from '../../../../ui/components/tooltip';
import { AgentIcon } from '../../../../ui/components/nand/AgentIcon';
import { RelativeTime } from '../../../../ui/components/nand/RelativeTime';
import { cn } from '../../../../ui/lib/utils';
import { useT } from '../../../../ui/react/hooks';
import { isActiveRun, type AutomationDefinition, type AutomationRun } from '../../../../shared/automation/types';
import { IconButton } from '../parts';
import { nextRun, scheduleLabel } from '../format';
import { LastRunCell } from './LastRunCell';
import { STICKY_CELL, TABLE_GRID, TABLE_ROW } from './table-layout';
export interface RowActions {
	onOpen: (definition: AutomationDefinition) => void;
	onRun: (definition: AutomationDefinition) => void;
	onEdit: (definition: AutomationDefinition) => void;
	onToggle: (definition: AutomationDefinition) => void;
	onDelete: (definition: AutomationDefinition) => void;
}
export function AutomationRow({
	definition: d,
	lastRun,
	selected,
	disabled,
	...actions
}: RowActions & { definition: AutomationDefinition; lastRun?: AutomationRun; selected: boolean; disabled: boolean }) {
	const t = useT(),
		layer = useTransient(),
		next = nextRun(d),
		running = !!lastRun && isActiveRun(lastRun);
	const ActionIcon = {
		agent: Bot,
		script: Terminal,
		notify: Bell,
		'create-task': CheckSquare,
		'open-file': File,
		'open-url': Globe,
		'obsidian-command': Command,
	}[d.action.kind];
	return (
		<div
			role="row"
			data-automation-row-id={d.id}
			data-current={selected ? 'true' : undefined}
			aria-selected={selected}
			className={cn(TABLE_GRID, TABLE_ROW, selected && 'bg-accent text-accent-foreground')}
			onClick={(event) => {
				if (!event.currentTarget.contains(event.target as Node)) return;
				if (!d.removedAction) actions.onOpen(d);
			}}
		>
			<span role="cell" className={STICKY_CELL}>
				{running && <span className="absolute -left-3 top-0 bottom-0 w-0.5 bg-primary" />}
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<button
							type="button"
							className="min-h-8 min-w-0 truncate text-left font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50"
							onClick={(e) => {
								e.stopPropagation();
								if (!d.removedAction) actions.onOpen(d);
							}}
						>
							{d.name}
						</button>
						{!d.enabled && (
							<Badge variant="secondary" className="text-2xs">
								{t('automation.disabled')}
							</Badge>
						)}
					</div>
					{d.source && (
						<div className="truncate text-xs text-muted-foreground">
							{t('automation.sourceLabel', {
								kind: t(`automation.source.${d.source.kind}`),
								name: d.source.path,
							})}
						</div>
					)}
				</div>
			</span>
			<span role="cell" className="min-w-0 truncate text-muted-foreground" title={scheduleLabel(d.schedule)}>
				{scheduleLabel(d.schedule)}
			</span>
			<span role="cell" className="min-w-0 text-muted-foreground">
				<span className="flex items-center gap-1.5 truncate">
					<ActionIcon className="size-3.5 shrink-0" />
					{t(d.removedAction ? 'automation.removedAction' : `automation.${d.action.kind}`)}
				</span>
				{'cwd' in d.action && (
					<span className="block truncate text-xs" title={d.action.cwd}>
						{d.action.cwd}
					</span>
				)}
			</span>
			<span role="cell" className="min-w-0 truncate text-muted-foreground">
				{next ? <RelativeTime value={next} /> : '—'}
			</span>
			<span role="cell">
				<LastRunCell run={lastRun} />
			</span>
			<span role="cell" onClick={(event) => event.stopPropagation()}>
				<Switch
					checked={d.enabled}
					disabled={disabled || !!d.removedAction}
					aria-label={t(d.enabled ? 'automation.pauseNamed' : 'automation.resumeNamed', { name: d.name })}
					onCheckedChange={() => actions.onToggle(d)}
				/>
			</span>
			<span role="cell" className="flex justify-center">
				{d.action.kind === 'agent' ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<AgentIcon agent={d.action.agentId} />
							</span>
						</TooltipTrigger>
						{layer.visible && <TooltipContent>{d.action.agentId}</TooltipContent>}
					</Tooltip>
				) : (
					'—'
				)}
			</span>
			<span role="cell" className="relative flex justify-end" onClick={(event) => event.stopPropagation()}>
				<div className="absolute right-8 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md bg-accent px-1 group-hover/list-table-row:flex group-focus-within/list-table-row:flex">
					<IconButton
						label={t('automation.run')}
						size="icon-xs"
						disabled={disabled || !!d.removedAction}
						onClick={() => actions.onRun(d)}
					>
						<Play className="size-3.5" />
					</IconButton>
					<IconButton
						label={t('automation.edit')}
						size="icon-xs"
						disabled={disabled || !!d.removedAction}
						onClick={() => actions.onEdit(d)}
					>
						<Pencil className="size-3.5" />
					</IconButton>
					<IconButton
						label={t(d.enabled ? 'automation.pause' : 'automation.resume')}
						size="icon-xs"
						disabled={disabled || !!d.removedAction}
						onClick={() => actions.onToggle(d)}
					>
						{d.enabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
					</IconButton>
					<IconButton
						label={t('automation.delete')}
						size="icon-xs"
						disabled={disabled || running}
						onClick={() => actions.onDelete(d)}
					>
						<Trash2 className="size-3.5 text-destructive" />
					</IconButton>
				</div>
				<DropdownMenu open={layer.open} onOpenChange={layer.onOpenChange}>
					<Tooltip>
						<TooltipTrigger asChild>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon-xs"
									aria-label={t('automation.actionsFor', { name: d.name })}
									className="size-7 text-muted-foreground"
								>
									<MoreHorizontal className="size-4" />
								</Button>
							</DropdownMenuTrigger>
						</TooltipTrigger>
						{layer.visible && (
							<TooltipContent>{t('automation.actionsFor', { name: d.name })}</TooltipContent>
						)}
					</Tooltip>
					{layer.visible && (
						<DropdownMenuContent onCloseAutoFocus={layer.onCloseAutoFocus} align="end" className="w-48">
							<DropdownMenuItem
								disabled={disabled || !!d.removedAction}
								onSelect={() => actions.onRun(d)}
							>
								<Play className="size-3.5" />
								{t('automation.run')}
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={disabled || !!d.removedAction}
								onSelect={() => actions.onEdit(d)}
							>
								<Pencil className="size-3.5" />
								{t('automation.edit')}
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={disabled || !!d.removedAction}
								onSelect={() => actions.onToggle(d)}
							>
								{d.enabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
								{t(d.enabled ? 'automation.pause' : 'automation.resume')}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								disabled={disabled || running}
								onSelect={() => actions.onDelete(d)}
							>
								<Trash2 className="size-3.5" />
								{t('automation.delete')}
							</DropdownMenuItem>
						</DropdownMenuContent>
					)}
				</DropdownMenu>
			</span>
		</div>
	);
}
