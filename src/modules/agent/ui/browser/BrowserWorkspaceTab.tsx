// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/tab-bar/SortableTab.tsx
import { useSortable } from '@dnd-kit/sortable';
import { useState, useSyncExternalStore } from 'react';
import { Globe, Loader2, X } from 'lucide-react';
import type { BrowserTabData } from '../../core/workspace/model';
import { useWorkspaceUI } from '../workspace/workspace-context';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubTrigger,
	ContextMenuSubContent,
} from '../../../../ui/components/context-menu';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from '../../../../ui/components/alert-dialog';
import { cn } from '../../../../ui/lib/utils';
const emptySubscribe = () => () => undefined;
const emptyState = () => undefined;
export function BrowserWorkspaceTab({
	tab,
	groupId,
	active,
}: {
	tab: BrowserTabData;
	groupId: string;
	active: boolean;
}) {
	const { controller, close } = useWorkspaceUI(),
		workspace = controller.workspace,
		host = controller.browserHost(),
		page = host?.getPage(tab.pageId),
		t = useT();
	const state = useSyncExternalStore(page?.store.subscribe ?? emptySubscribe, page?.store.getState ?? emptyState);
	const profiles = useSyncExternalStore(
		host?.profiles.subscribe ?? emptySubscribe,
		host?.profiles.getState ?? emptyState,
	);
	const [broken, setBroken] = useState(''),
		[switchTo, setSwitchTo] = useState('');
	const {
		attributes,
		listeners,
		setNodeRef,
		isOver,
		active: dragged,
	} = useSortable({ id: tab.id, data: { groupId, kind: 'tab' } });
	const run = (promise: Promise<unknown> | undefined) => {
		void promise?.catch((error) => workspace.report(error));
	};
	const copy = (value: string) => run(controller.app.workspace.containerEl.win.navigator.clipboard.writeText(value));
	const group = workspace.group(tab.id)!;
	const closeScope = (scope: 'others' | 'right') => {
		const index = group.tabIds.indexOf(tab.id);
		for (const [i, id] of group.tabIds.entries())
			if (id !== tab.id && (scope === 'others' || i > index) && !workspace.store.getState().tabs[id]?.pinned)
				close(id);
	};
	const icon = state?.favicon || tab.faviconUrl;
	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div
						ref={setNodeRef}
						{...attributes}
						{...listeners}
						role="tab"
						aria-selected={active}
						tabIndex={active ? 0 : -1}
						data-tab-id={tab.id}
						data-active={active}
						className={cn(
							'group relative flex h-full w-[180px] min-w-[72px] shrink-0 cursor-pointer select-none items-center gap-1.5 border-t border-r border-border px-1.5 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 xl:w-[220px]',
							active
								? 'bg-[color-mix(in_srgb,var(--foreground)_6%,var(--card))] text-foreground'
								: 'bg-card text-muted-foreground hover:text-foreground',
							isOver && dragged?.id !== tab.id && 'border-l-2 border-l-ring',
						)}
						onClick={() => workspace.activate(tab.id)}
						onAuxClick={(e) => {
							if (e.button === 1) {
								e.preventDefault();
								close(tab.id);
							}
						}}
						onMouseDown={(e) => {
							if (e.button === 1) e.preventDefault();
						}}
						onKeyDown={(e) => {
							const index = group.tabIds.indexOf(tab.id);
							if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
								e.preventDefault();
								e.stopPropagation();
								const id =
									group.tabIds[
										e.key === 'Home'
											? 0
											: e.key === 'End'
												? group.tabIds.length - 1
												: (index + (e.key === 'ArrowLeft' ? -1 : 1) + group.tabIds.length) %
													group.tabIds.length
									];
								if (id) {
									workspace.activate(id);
									e.currentTarget.parentElement
										?.querySelector<HTMLElement>(`[data-tab-id="${id}"]`)
										?.focus();
								}
							} else if (e.key === 'Delete') {
								e.preventDefault();
								close(tab.id);
							} else if (e.key === 'Enter') {
								e.preventDefault();
								workspace.activate(tab.id);
							}
						}}
					>
						{state?.loading ? (
							<Loader2 className="size-4 shrink-0 animate-spin" />
						) : icon && broken !== icon ? (
							<img
								src={icon}
								alt=""
								className="size-4 shrink-0 rounded-sm"
								onError={() => setBroken(icon)}
							/>
						) : (
							<Globe className="size-4 shrink-0" />
						)}
						<span className="min-w-0 flex-1 truncate">
							{tab.customTitle || tab.title || t('browser.newTab')}
						</span>
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
						{active && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-foreground" />}
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem disabled={!page} onSelect={() => run(page?.reload())}>
						{t('browser.reload')}
					</ContextMenuItem>
					<ContextMenuItem onSelect={() => copy(tab.url)}>{t('browser.copyUrl')}</ContextMenuItem>
					<ContextMenuItem onSelect={() => copy(`[${tab.title}](${tab.url})`)}>
						{t('browser.copyMarkdown')}
					</ContextMenuItem>
					<ContextMenuItem disabled={!page} onSelect={() => page?.openExternal()}>
						{t('browser.external')}
					</ContextMenuItem>
					<ContextMenuItem
						onSelect={() => workspace.newBrowser(tab.url, { groupId, profileId: tab.profileId })}
					>
						{t('browser.duplicateTab')}
					</ContextMenuItem>
					<ContextMenuSub>
						<ContextMenuSubTrigger>{t('browser.defaultProfile')}</ContextMenuSubTrigger>
						<ContextMenuSubContent>
							{profiles?.profiles.map((p) => (
								<ContextMenuItem
									key={p.id}
									disabled={p.state !== 'ready' || p.id === tab.profileId}
									onSelect={() => setSwitchTo(p.id)}
								>
									{p.label || t('browser.profile.default')}
								</ContextMenuItem>
							))}
						</ContextMenuSubContent>
					</ContextMenuSub>
					<ContextMenuSeparator />
					{(['right', 'down'] as const).map((edge) => (
						<ContextMenuItem
							key={edge}
							disabled={workspace.store.getState().groups.length >= 4}
							onSelect={() => workspace.move(tab.id, { split: edge, ofGroupId: groupId })}
						>
							{t(`agent.workspace.split.${edge}`)}
						</ContextMenuItem>
					))}
					<ContextMenuSeparator />
					<ContextMenuItem onSelect={() => close(tab.id)}>{t('agent.workspace.closeTab')}</ContextMenuItem>
					{(['others', 'right'] as const).map((scope) => (
						<ContextMenuItem key={scope} onSelect={() => closeScope(scope)}>
							{t(`agent.workspace.close.${scope}`)}
						</ContextMenuItem>
					))}
				</ContextMenuContent>
			</ContextMenu>
			<AlertDialog
				open={!!switchTo}
				onOpenChange={(open) => {
					if (!open) setSwitchTo('');
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t('browser.defaultProfile')}</AlertDialogTitle>
						<AlertDialogDescription>
							{t('browser.profile.switch', {
								name:
									profiles?.profiles.find((p) => p.id === switchTo)?.label ||
									t('browser.profile.default'),
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t('browser.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								run(page?.setProfile(switchTo));
								setSwitchTo('');
							}}
						>
							{t('browser.apply')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
