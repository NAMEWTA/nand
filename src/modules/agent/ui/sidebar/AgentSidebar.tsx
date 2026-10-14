// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/sidebar/SidebarNav.tsx, worktree-card-surface.tsx, StatusIndicator.tsx
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import {
	ChartNoAxesColumn,
	ChevronDown,
	LayoutDashboard,
	ListFilter,
	MoreHorizontal,
	PanelLeftClose,
	Search,
	Timer,
} from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '../../../../ui/components/dropdown-menu';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from '../../../../ui/components/context-menu';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '../../../../ui/components/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/components/tooltip';
import { useT } from '../../../../ui/react/hooks';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { cn } from '../../../../ui/lib/utils';
import type { WorkspaceTab } from '../../core/workspace/model';
import { useWorkspaceUI } from '../workspace/workspace-context';
import { TabLeadingIcon } from '../tabs/TabLeadingIcon';
import { NewTabMenu } from '../create/NewTabMenu';
import { sessionBucket } from '../../core/workspace/sidebar';
import { pickMaterial } from '../terminal/material-picker';
import { openPath } from '../../platform/desktop/files';
export function shortPath(path: string): string {
	const parts = path.split(/[\\/]/).filter(Boolean);
	return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : path;
}
function SessionCard({ tab }: { tab: WorkspaceTab }) {
	const { controller, close, confirm } = useWorkspaceUI(),
		workspace = controller.workspace,
		t = useT(),
		doc = useOwnerDocument();
	const [rename, setRename] = useState(false),
		[draft, setDraft] = useState('');
	const current = workspace.active?.id === tab.id,
		group = workspace.group(tab.id)!;
	const path = tab.kind === 'terminal' ? (tab.panes[tab.focusedSessionId]?.cwd ?? '') : tab.url;
	const session = tab.kind === 'terminal' ? controller.sessions.get(tab.focusedSessionId) : undefined;
	const actions: { label: string; run: () => void; destructive?: boolean; disabled?: boolean }[] = [
		{
			label: t('agent.rename'),
			run: () => {
				setDraft(tab.customTitle || tab.title);
				setRename(true);
			},
		},
		{
			label: t('agent.workspace.split.right'),
			run: () => workspace.move(tab.id, { split: 'right', ofGroupId: group.id }),
		},
		{
			label: t('agent.workspace.split.down'),
			run: () => workspace.move(tab.id, { split: 'down', ofGroupId: group.id }),
		},
		{
			label: t('agent.copyId'),
			run: () => {
				void doc.defaultView?.navigator.clipboard
					.writeText(
						tab.kind === 'terminal'
							? tab.panes[tab.focusedSessionId]?.nativeSessionId || tab.focusedSessionId
							: tab.url,
					)
					.catch((e) => workspace.report(e));
			},
		},
		{
			label: t('agent.copyPath'),
			run: () => {
				void doc.defaultView?.navigator.clipboard.writeText(path).catch((e) => workspace.report(e));
			},
		},
		...(tab.kind === 'terminal'
			? [
					{
						label: t('agent.reveal'),
						run: () => {
							void openPath(path).catch((e) => workspace.report(e));
						},
					},
				]
			: []),
		...(session?.agentId
			? [
					{
						label: t('agent.attach'),
						disabled: !session.running,
						run: () => pickMaterial(controller, session.id),
					},
				]
			: []),
		...(tab.kind === 'terminal'
			? [
					{
						label: t('agent.end'),
						destructive: true,
						disabled: !tab.sessionIds.some((id) => controller.sessions.get(id)?.running),
						run: () => {
							void workspace.end(tab.id, confirm).catch((e) => workspace.report(e));
						},
					},
				]
			: []),
		{ label: t('agent.workspace.closeTab'), run: () => close(tab.id) },
	];
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const win = doc.defaultView;
		const timer = win?.setInterval(() => setNow(Date.now()), 60_000);
		return () => win?.clearInterval(timer);
	}, [doc]);
	const age = Math.max(0, Math.floor((now - tab.createdAt) / 60_000));
	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<div
						data-current={current || undefined}
						data-session-card={tab.id}
						className={cn(
							'group mx-2 flex items-start rounded-md px-2 py-1.5 hover:bg-sidebar-accent/60',
							current && 'bg-sidebar-accent',
							tab.kind === 'terminal' &&
								['waiting', 'permission'].includes(tab.state) &&
								'bg-agent-question/8',
						)}
					>
						<button
							type="button"
							className="flex min-w-0 flex-1 flex-col items-stretch justify-start rounded-sm text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
							onClick={() => workspace.activate(tab.id)}
							onDoubleClick={actions[0]!.run}
						>
							<span className="flex items-center gap-2">
								<TabLeadingIcon tab={tab} sidebar />
								<span
									className={cn(
										'min-w-0 truncate text-[13px] font-medium',
										tab.kind === 'terminal' && tab.unread && 'font-bold',
									)}
								>
									{tab.customTitle || tab.title}
								</span>
							</span>
							<span className="mt-0.5 block truncate pl-5 text-xs text-muted-foreground" title={path}>
								{shortPath(path)} · {age ? t('agent.minutesAgo', { count: age }) : t('agent.justNow')}
							</span>
						</button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon-xs"
									className="size-5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
									aria-label={t('agent.more')}
								>
									<MoreHorizontal className="size-3" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								{actions.map((action) => (
									<DropdownMenuItem
										key={action.label}
										disabled={action.disabled}
										variant={action.destructive ? 'destructive' : 'default'}
										onSelect={action.run}
									>
										{action.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent>
					{actions.map((action) => (
						<ContextMenuItem
							key={action.label}
							disabled={action.disabled}
							variant={action.destructive ? 'destructive' : 'default'}
							onSelect={action.run}
						>
							{action.label}
						</ContextMenuItem>
					))}
				</ContextMenuContent>
			</ContextMenu>
			<Dialog open={rename} onOpenChange={setRename}>
				<DialogContent>
					<DialogTitle>{t('agent.rename')}</DialogTitle>
					<Input
						autoFocus
						aria-label={t('agent.renameLabel')}
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
								workspace.rename(tab.id, draft);
								setRename(false);
							}
						}}
					/>
					<DialogFooter>
						<Button
							onClick={() => {
								workspace.rename(tab.id, draft);
								setRename(false);
							}}
						>
							{t('common.save')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
export function AgentSidebar({ togglePanel }: { togglePanel?: () => void }) {
	const { controller } = useWorkspaceUI(),
		state = useStore(controller.workspace.store),
		t = useT();
	const [query, setQuery] = useState(''),
		[search, setSearch] = useState(false),
		[collapsed, setCollapsed] = useState<string[]>([]);
	const [filters, setFilters] = useState({ terminal: true, browser: true, done: true, idle: false }),
		[grouping, setGrouping] = useState<'status' | 'agent' | 'none'>('status');
	const grouped: Record<string, WorkspaceTab[]> = {};
	for (const tab of Object.values(state.tabs)) {
		if (!(tab.customTitle || tab.title).toLocaleLowerCase().includes(query.toLocaleLowerCase())) continue;
		const bucket = sessionBucket(tab);
		if (bucket in filters && !filters[bucket as keyof typeof filters]) continue;
		const key =
			grouping === 'none'
				? 'all'
				: grouping === 'agent'
					? tab.kind === 'terminal'
						? (tab.agentId ?? 'terminal')
						: 'browser'
					: bucket;
		(grouped[key] ??= []).push(tab);
	}
	const order =
		grouping === 'status'
			? ['attention', 'working', 'done', 'unknown', 'idle', 'terminal', 'browser']
			: Object.keys(grouped);
	return (
		<aside
			className="nand-ui flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground"
			aria-label={t('workbench.agent')}
		>
			<div className="flex h-9 shrink-0 items-center gap-2 px-3">
				<span className="flex-1 text-sm font-semibold">{t('workbench.agent')}</span>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label={t('agent.workspace.toggleSidebar')}
							onClick={togglePanel}
						>
							<PanelLeftClose className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t('agent.workspace.toggleSidebar')}</TooltipContent>
				</Tooltip>
			</div>
			<div className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
				<button
					type="button"
					onClick={() => setSearch(!search)}
					className="group flex w-full items-center justify-start gap-2 rounded-md bg-foreground/5 px-2 py-1.5 text-left text-[13px] font-medium tracking-tight text-foreground/60 hover:bg-foreground/8"
				>
					<Search className="size-4 text-foreground/30" strokeWidth={1.75} />
					<span className="flex-1">{t('agent.search')}</span>
				</button>
				{search && (
					<Input
						autoFocus
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						aria-label={t('agent.search')}
						className="h-8 text-xs"
					/>
				)}
				{[
					{ key: 'board', icon: LayoutDashboard },
					{ key: 'automations', icon: Timer },
					{ key: 'stats', icon: ChartNoAxesColumn },
				].map((item) => (
					<Tooltip key={item.key}>
						<TooltipTrigger asChild>
							<button
								type="button"
								aria-disabled={item.key !== 'automations'}
								onClick={() => {
									if (item.key === 'automations') void controller.open({ feature: 'automations' });
								}}
								className="flex w-full items-center justify-start gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-sidebar-foreground/60 hover:bg-sidebar-foreground/8 aria-disabled:opacity-50"
							>
								<item.icon className="size-4 text-sidebar-foreground/30" strokeWidth={1.75} />
								{t(`agent.workspace.nav.${item.key}`)}
							</button>
						</TooltipTrigger>
						<TooltipContent>
							{t(
								item.key === 'automations'
									? 'agent.workspace.nav.automations'
									: 'agent.workspace.future',
							)}
						</TooltipContent>
					</Tooltip>
				))}
			</div>
			<div className="flex items-center px-3 pt-3 pb-1">
				<span className="flex-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
					{t('agent.sessions')}
				</span>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon-xs" aria-label={t('agent.workspace.filters')}>
							<ListFilter className="size-3.5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						{(Object.keys(filters) as (keyof typeof filters)[]).map((key) => (
							<DropdownMenuCheckboxItem
								key={key}
								checked={filters[key]}
								onCheckedChange={(value) => setFilters((f) => ({ ...f, [key]: value }))}
							>
								{t(`agent.workspace.show.${key}`)}
							</DropdownMenuCheckboxItem>
						))}
						{(['status', 'agent', 'none'] as const).map((key) => (
							<DropdownMenuCheckboxItem
								key={key}
								checked={grouping === key}
								onCheckedChange={() => setGrouping(key)}
							>
								{t(`agent.workspace.group.${key}`)}
							</DropdownMenuCheckboxItem>
						))}
						<DropdownMenuItem
							onSelect={() => {
								setFilters({ terminal: true, browser: true, done: true, idle: false });
								setGrouping('status');
								setQuery('');
							}}
						>
							{t('agent.workspace.resetFilters')}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<NewTabMenu controller={controller} groupId={state.activeGroupId} />
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto pb-2">
				{order.map((key) =>
					grouped[key]?.length ? (
						<section key={key}>
							<button
								type="button"
								aria-expanded={!collapsed.includes(key)}
								className="flex w-full items-center gap-1 px-3 py-1 text-xs text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
								onClick={() =>
									setCollapsed((v) => (v.includes(key) ? v.filter((k) => k !== key) : [...v, key]))
								}
							>
								<ChevronDown className={cn('size-3', collapsed.includes(key) && '-rotate-90')} />
								{grouping === 'agent' && !['terminal', 'browser'].includes(key)
									? grouped[key][0]?.kind === 'terminal' &&
										controller.agentTitle(grouped[key][0].agentId!)
									: t(`agent.workspace.bucket.${key}`)}
								<span className="ml-auto">{grouped[key].length}</span>
							</button>
							{!collapsed.includes(key) &&
								grouped[key].map((tab) => <SessionCard key={tab.id} tab={tab} />)}
						</section>
					) : null,
				)}
			</div>
		</aside>
	);
}
