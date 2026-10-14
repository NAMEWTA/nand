// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/tab-bar/SortableTab.tsx
import { useSortable } from '@dnd-kit/sortable';
import { useState } from 'react';
import { Pin, X } from 'lucide-react';
import type { WorkspaceTab as Tab, TabColor } from '../../core/workspace/model';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from '../../../../ui/components/context-menu';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/components/tooltip';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { cn } from '../../../../ui/lib/utils';
import { TabLeadingIcon } from './TabLeadingIcon';
import { useWorkspaceUI } from '../workspace/workspace-context';
const colors: Record<TabColor, string> = {
	red: 'bg-status-error',
	orange: 'bg-agent-question',
	yellow: 'bg-status-warning',
	green: 'bg-status-success',
	blue: 'bg-chart-1',
	purple: 'bg-chart-2',
	pink: 'bg-chart-3',
	gray: 'bg-muted-foreground',
};
export function WorkspaceTab({ tab, groupId, active }: { tab: Tab; groupId: string; active: boolean }) {
	const { controller, close } = useWorkspaceUI(),
		workspace = controller.workspace,
		t = useT(),
		doc = useOwnerDocument();
	const [editing, setEditing] = useState(false),
		[draft, setDraft] = useState('');
	const {
		attributes,
		listeners,
		setNodeRef,
		isOver,
		active: dragged,
	} = useSortable({ id: tab.id, data: { groupId, kind: 'tab' } });
	const rename = () => {
		setDraft(tab.customTitle || tab.title);
		setEditing(true);
	};
	const finish = () => {
		workspace.rename(tab.id, draft);
		setEditing(false);
	};
	const group = workspace.group(tab.id)!;
	const closeScope = async (scope: 'others' | 'left' | 'right') => {
		const index = group.tabIds.indexOf(tab.id);
		for (const [i, id] of group.tabIds.entries())
			if (
				id !== tab.id &&
				!workspace.store.getState().tabs[id]?.pinned &&
				(scope === 'others' || (scope === 'left' && i < index) || (scope === 'right' && i > index))
			)
				close(id);
	};
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					ref={setNodeRef}
					{...attributes}
					{...(editing ? {} : listeners)}
					role="tab"
					aria-selected={active}
					tabIndex={active ? 0 : -1}
					data-tab-id={tab.id}
					data-active={active}
					data-pinned={tab.pinned || undefined}
					className={cn(
						'group relative flex h-full w-[180px] min-w-[72px] shrink-0 cursor-pointer select-none items-center gap-1.5 border-t border-r border-border px-1.5 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 xl:w-[220px]',
						active
							? 'bg-[color-mix(in_srgb,var(--foreground)_6%,var(--card))] text-foreground'
							: 'bg-card text-muted-foreground hover:text-foreground',
						isOver && dragged?.id !== tab.id && 'border-l-2 border-l-ring',
					)}
					onClick={() => {
						if (!editing) workspace.activate(tab.id);
					}}
					onDoubleClick={rename}
					onAuxClick={(event) => {
						if (event.button === 1 && !tab.pinned) {
							event.preventDefault();
							close(tab.id);
						}
					}}
					onMouseDown={(event) => {
						if (event.button === 1) event.preventDefault();
					}}
					onKeyDown={(event) => {
						if (editing) return;
						const index = group.tabIds.indexOf(tab.id),
							keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
						if (keys.includes(event.key)) {
							event.preventDefault();
							event.stopPropagation();
							const id =
								group.tabIds[
									event.key === 'Home'
										? 0
										: event.key === 'End'
											? group.tabIds.length - 1
											: (index + (event.key === 'ArrowLeft' ? -1 : 1) + group.tabIds.length) %
												group.tabIds.length
								];
							if (id) {
								workspace.activate(id);
								event.currentTarget.parentElement
									?.querySelector<HTMLElement>(`[data-tab-id="${id}"]`)
									?.focus();
							}
						} else if (event.key === 'Delete') {
							event.preventDefault();
							if (!tab.pinned) close(tab.id);
						} else if (event.key === 'Enter') {
							event.preventDefault();
							workspace.activate(tab.id);
						}
					}}
				>
					{tab.color && <span className={cn('absolute inset-x-0 top-0 h-[2px]', colors[tab.color])} />}
					<TabLeadingIcon tab={tab} />
					{tab.pinned && <Pin className="size-3" />}
					{editing ? (
						<Input
							autoFocus
							aria-label={t('agent.renameLabel')}
							className="h-6 min-w-0 flex-1 px-1 text-xs"
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							onBlur={finish}
							onKeyDown={(event) => {
								event.stopPropagation();
								if (event.nativeEvent.isComposing) return;
								if (event.key === 'Enter') finish();
								if (event.key === 'Escape') setEditing(false);
							}}
						/>
					) : (
						<span className="min-w-0 flex-1 truncate">{tab.customTitle || tab.title}</span>
					)}
					{!tab.pinned && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon-xs"
									className={cn(
										'size-4 rounded-sm',
										!active && 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
									)}
									aria-label={t('agent.workspace.closeTab')}
									onPointerDown={(e) => e.stopPropagation()}
									onClick={(e) => {
										e.stopPropagation();
										close(tab.id);
									}}
								>
									<X className="size-3" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>{t('agent.workspace.closeTab')}</TooltipContent>
						</Tooltip>
					)}
					{active && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-foreground" />}
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent>
				<ContextMenuItem onSelect={rename}>{t('agent.renameLabel')}</ContextMenuItem>
				<ContextMenuSub>
					<ContextMenuSubTrigger>{t('agent.workspace.tabColor')}</ContextMenuSubTrigger>
					<ContextMenuSubContent>
						<ContextMenuItem onSelect={() => workspace.decorate(tab.id, { color: undefined })}>
							{t('agent.workspace.color.none')}
						</ContextMenuItem>
						{(Object.keys(colors) as TabColor[]).map((color) => (
							<ContextMenuItem key={color} onSelect={() => workspace.decorate(tab.id, { color })}>
								<span className={cn('size-2 rounded-full', colors[color])} />
								{t(`agent.workspace.color.${color}`)}
							</ContextMenuItem>
						))}
					</ContextMenuSubContent>
				</ContextMenuSub>
				<ContextMenuItem onSelect={() => workspace.decorate(tab.id, { pinned: !tab.pinned })}>
					{t(tab.pinned ? 'agent.workspace.unpin' : 'agent.workspace.pin')}
				</ContextMenuItem>
				{(['right', 'down'] as const).map((edge) => (
					<ContextMenuItem
						key={edge}
						disabled={workspace.store.getState().groups.length >= 4}
						onSelect={() => workspace.move(tab.id, { split: edge, ofGroupId: groupId })}
					>
						{t(`agent.workspace.split.${edge}`)}
					</ContextMenuItem>
				))}
				<ContextMenuItem
					onSelect={() => {
						void doc.defaultView?.navigator.clipboard
							.writeText(
								tab.kind === 'browser'
									? tab.url
									: tab.panes[tab.focusedSessionId]?.nativeSessionId || tab.focusedSessionId,
							)
							.catch((error) => workspace.report(error));
					}}
				>
					{t(tab.kind === 'browser' ? 'agent.workspace.copyUrl' : 'agent.copyId')}
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuItem disabled={tab.pinned} onSelect={() => close(tab.id)}>
					{t('agent.workspace.closeTab')}
				</ContextMenuItem>
				{(['others', 'right', 'left'] as const).map((scope) => (
					<ContextMenuItem
						key={scope}
						onSelect={() => {
							void closeScope(scope);
						}}
					>
						{t(`agent.workspace.close.${scope}`)}
					</ContextMenuItem>
				))}
			</ContextMenuContent>
		</ContextMenu>
	);
}
