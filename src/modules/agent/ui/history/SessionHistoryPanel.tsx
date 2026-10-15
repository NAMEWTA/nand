// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/right-sidebar/AiVaultPanelHeader.tsx, AiVaultPanelControls.tsx, AiVaultSessionVirtualList.tsx, AiVaultSessionRow.tsx, AiVaultSessionDetails.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Copy, ListFilter, MoreHorizontal, Play, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from '../../../../ui/components/dropdown-menu';
import { SegmentedControl } from '../../../../ui/components/nand/SettingsFormControls';
import { AgentIcon } from '../../../../ui/components/nand/AgentIcon';
import { useT } from '../../../../ui/react/hooks';
import { useOwnerDocument, useVisible } from '../../../../ui/react/contexts';
import { AGENT_CATALOG } from '../../core/launch/catalog';
import type { AgentController } from '../../services/controller';
import type { HistoryRow } from '../../services/history-store';
import { shortPath } from '../sidebar/AgentSidebar';
export const HISTORY_DRAG = 'application/x-nand-history-session';
function SessionRow({ row, controller }: { row: HistoryRow; controller: AgentController }) {
	const t = useT(),
		doc = useOwnerDocument(),
		[expanded, setExpanded] = useState(false);
	const run = (p: Promise<unknown>) => {
		void p.catch((e) => controller.workspace.report(e));
	};
	const copy = (text: string) => run(doc.defaultView!.navigator.clipboard.writeText(text));
	const actions = [
		{ label: t('agent.historyUI.resume'), run: () => run(controller.resume(row)) },
		{ label: t('agent.historyUI.copyResume'), run: () => run(controller.resumeCommand(row).then(copy)) },
		{ label: t('agent.copyId'), run: () => copy(row.sessionId) },
		{ label: t('agent.historyUI.copyLog'), run: () => copy(row.transcriptPath) },
		{ label: t('agent.historyUI.openLog'), run: () => run(controller.openHistoryPath(row, 'log')) },
		{ label: t('agent.historyUI.revealLog'), run: () => run(controller.openHistoryPath(row, 'reveal')) },
		{ label: t('agent.historyUI.openCwd'), run: () => run(controller.openHistoryPath(row, 'cwd')) },
		{ label: t('agent.historyUI.export'), run: () => run(controller.history().export(row)) },
		{
			label: t(row.metadata.favorite ? 'agent.historyUI.unfavorite' : 'agent.historyUI.favorite'),
			run: () => run(controller.historyStore.annotate(row.key, { favorite: !row.metadata.favorite })),
		},
		{
			label: t(row.metadata.archived ? 'agent.historyUI.unarchive' : 'agent.historyUI.archive'),
			run: () => run(controller.historyStore.annotate(row.key, { archived: !row.metadata.archived })),
		},
	];
	const menu = (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon-xs" aria-label={t('agent.historyUI.actions')}>
					<MoreHorizontal className="size-3.5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{actions.map((a) => (
					<DropdownMenuItem key={a.label} onSelect={a.run}>
						{a.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
	return (
		<article
			className="border-b border-sidebar-border/60"
			data-history-row={row.key}
			draggable
			onDragStart={(e) => {
				e.dataTransfer.setData(HISTORY_DRAG, row.key);
				e.dataTransfer.effectAllowed = 'copy';
			}}
		>
			<div className="group flex items-start gap-1 px-2.5 py-2 hover:bg-sidebar-accent/50">
				<button
					type="button"
					className="flex min-w-0 flex-1 items-start gap-2 text-left"
					aria-expanded={expanded}
					onClick={() => setExpanded(!expanded)}
				>
					<AgentIcon agent={row.agentId} size={14} />
					<span className="min-w-0 flex-1">
						<span className="block truncate text-[12px] font-medium text-foreground">
							{row.metadata.favorite ? '★ ' : ''}
							{row.metadata.title || row.title}
						</span>
						<span className="block truncate text-[11px] text-muted-foreground">
							{shortPath(row.cwd)} · {row.model || t('agent.stats.unknown')} ·{' '}
							{new Date(row.modifiedAtMs).toLocaleDateString()}
						</span>
					</span>
				</button>
				{menu}
			</div>
			{expanded && (
				<div className="border-t border-sidebar-border/70 bg-background/30">
					<div className="space-y-3 p-3">
						<div className="space-y-1 text-[11px] text-muted-foreground">
							<p className="break-all">{row.cwd}</p>
							<p>
								{row.model || t('agent.stats.unknown')} ·{' '}
								{t('agent.historyUI.messages', { count: row.messageCount })}
							</p>
						</div>
						<Input
							aria-label={t('agent.rename')}
							defaultValue={row.metadata.title || row.title}
							onBlur={(e) => {
								const title = e.target.value.trim();
								if (title && title !== (row.metadata.title || row.title))
									run(controller.historyStore.annotate(row.key, { title }));
							}}
						/>
						<section className="space-y-1.5">
							<div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
								<span>{t('agent.historyUI.firstPrompt')}</span>
								<Button
									variant="ghost"
									size="icon-xs"
									aria-label={t('agent.historyUI.copyPrompt')}
									onClick={() => copy(row.firstPrompt)}
								>
									<Copy className="size-3" />
								</Button>
							</div>
							<p className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/70 bg-foreground/[0.04] px-2.5 py-2 text-xs">
								{row.firstPrompt || t('agent.historyUI.noPreview')}
							</p>
						</section>
						<section className="space-y-1.5">
							<h4 className="text-[11px] font-semibold uppercase text-muted-foreground">
								{t('agent.historyUI.latest')}
							</h4>
							{row.turns.slice(-5).map((turn, index) => (
								<div
									key={index}
									className="rounded-md border border-sidebar-border/70 bg-sidebar-accent/25 px-2.5 py-2"
								>
									<span className="text-[10px] font-semibold uppercase text-muted-foreground">
										{t(`agent.historyUI.role.${turn.role}`)}
									</span>
									<p className="line-clamp-2 text-[12px] leading-[1.35] text-foreground/90 [overflow-wrap:anywhere]">
										{turn.text}
									</p>
								</div>
							))}
						</section>
						{row.readError && (
							<p role="alert" className="text-xs text-destructive">
								{row.readError}
							</p>
						)}
						<div className="flex flex-wrap items-center gap-1">
							<Button variant="secondary" size="xs" onClick={() => run(controller.resume(row))}>
								<Play className="size-3.5" />
								{t('agent.historyUI.resume')}
							</Button>
							<Button variant="ghost" size="xs" onClick={() => run(controller.resumeCommand(row).then(copy))}>
								{t('agent.historyUI.copyResume')}
							</Button>
						</div>
					</div>
				</div>
			)}
		</article>
	);
}
export function SessionHistoryPanel({ controller, close }: { controller: AgentController; close: () => void }) {
	'use no memo';
	const t = useT(),
		state = useStore(controller.historyStore.store),
		visible = useVisible(),
		scroll = useRef<HTMLDivElement>(null);
	const [query, setQuery] = useState(''),
		[scope, setScope] = useState<'vault' | 'all'>('vault'),
		[agents, setAgents] = useState(AGENT_CATALOG.map((a) => a.id as string)),
		[group, setGroup] = useState<'none' | 'agent' | 'cwd'>('none'),
		[sort, setSort] = useState<'updated' | 'created'>('updated'),
		[hideEmpty, setHideEmpty] = useState(false),
		[archived, setArchived] = useState(false);
	useEffect(() => {
		if (visible) void controller.historyStore.refresh(false);
	}, [controller, visible]);
	const filtered = useMemo(
		() =>
			state.rows
				.filter(
					(row) =>
						agents.includes(row.agentId) &&
						(!row.metadata.archived || archived) &&
						(!hideEmpty || row.messageCount > 0) &&
						(scope === 'all' || row.inVault) &&
						[
							row.metadata.title,
							row.title,
							row.cwd,
							row.model,
							row.firstPrompt,
							...row.turns.slice(-5).map((x) => x.text),
						]
							.join(' ')
							.toLowerCase()
							.includes(query.toLowerCase()),
				)
				.sort((a, b) =>
					sort === 'created' ? (b.createdAt ?? 0) - (a.createdAt ?? 0) : b.modifiedAtMs - a.modifiedAtMs,
				),
		[state.rows, agents, archived, hideEmpty, scope, query, sort],
	);
	const rows = useMemo(() => {
		const groups = new Map<string, HistoryRow[]>();
		for (const row of filtered) {
			const key =
				group === 'agent'
					? AGENT_CATALOG.find((a) => a.id === row.agentId)?.title || row.agentId
					: group === 'cwd'
						? row.cwd
						: '';
			const items = groups.get(key) ?? [];
			items.push(row);
			groups.set(key, items);
		}
		return [...groups].flatMap(([key, items]) => [
			...(key ? [{ key: `group:${key}`, label: key }] : []),
			...items.map((row) => ({ key: row.key, row })),
		]);
	}, [filtered, group]);
	const virtual = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scroll.current,
		estimateSize: (index) => ('row' in rows[index]! ? 64 : 32),
		getItemKey: (index) => rows[index]!.key,
		overscan: 8,
	});
	return (
		<aside className="@container/ai-vault flex h-full min-h-0 flex-col bg-sidebar" aria-label={t('agent.history')}>
			<div className="shrink-0 border-b border-sidebar-border px-2.5 py-2">
				<div className="flex items-center gap-1.5">
					<div className="min-w-0 flex-1">
						<h3 className="truncate text-xs font-semibold text-foreground">{t('agent.history')}</h3>
						<p className="truncate text-[11px] text-muted-foreground">
							{t('agent.historyUI.count', { shown: filtered.length, total: state.rows.length })}
						</p>
					</div>
					<Button
						variant="ghost"
						size="icon-xs"
						disabled={state.loading}
						aria-label={t('agent.refresh')}
						onClick={() => {
							void controller.historyStore.refresh();
						}}
					>
						<RefreshCw
							className={state.loading ? 'size-3 animate-spin motion-reduce:animate-none' : 'size-3'}
						/>
					</Button>
					<Button variant="ghost" size="icon-xs" aria-label={t('agent.close')} onClick={close}>
						<X className="size-3" />
					</Button>
				</div>
				<div className="mt-2 flex items-center gap-1.5">
					<Search className="size-3.5 text-muted-foreground" />
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t('agent.historyUI.search')}
						aria-label={t('agent.historyUI.search')}
						className="h-8 min-w-0 flex-1 text-xs"
					/>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon-xs" aria-label={t('agent.historyUI.view')}>
								<ListFilter className="size-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuLabel>{t('agent.historyUI.agents')}</DropdownMenuLabel>
							<DropdownMenuItem
								onSelect={(e) => {
									e.preventDefault();
									setAgents(AGENT_CATALOG.map((a) => a.id));
								}}
							>
								{t('agent.historyUI.all')}
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={(e) => {
									e.preventDefault();
									setAgents([]);
								}}
							>
								{t('agent.historyUI.clear')}
							</DropdownMenuItem>
							{AGENT_CATALOG.map((a) => (
								<DropdownMenuCheckboxItem
									key={a.id}
									checked={agents.includes(a.id)}
									onSelect={(e) => e.preventDefault()}
									onCheckedChange={(value) =>
										setAgents((old) => (value ? [...old, a.id] : old.filter((id) => id !== a.id)))
									}
								>
									{a.title}
								</DropdownMenuCheckboxItem>
							))}
							<DropdownMenuSeparator />
							{(['updated', 'created'] as const).map((value) => (
								<DropdownMenuCheckboxItem
									key={value}
									checked={sort === value}
									onCheckedChange={() => setSort(value)}
								>
									{t(`agent.historyUI.${value}`)}
								</DropdownMenuCheckboxItem>
							))}
							<DropdownMenuSeparator />
							{(['none', 'agent', 'cwd'] as const).map((value) => (
								<DropdownMenuCheckboxItem
									key={value}
									checked={group === value}
									onCheckedChange={() => setGroup(value)}
								>
									{t(`agent.historyUI.group.${value}`)}
								</DropdownMenuCheckboxItem>
							))}
							<DropdownMenuSeparator />
							<DropdownMenuCheckboxItem checked={hideEmpty} onCheckedChange={setHideEmpty}>
								{t('agent.historyUI.hideEmpty')}
							</DropdownMenuCheckboxItem>
							<DropdownMenuCheckboxItem checked={archived} onCheckedChange={setArchived}>
								{t('agent.historyUI.showArchived')}
							</DropdownMenuCheckboxItem>
							<DropdownMenuItem
								onSelect={() => {
									setQuery('');
									setAgents(AGENT_CATALOG.map((a) => a.id));
									setGroup('none');
									setSort('updated');
									setHideEmpty(false);
									setArchived(false);
								}}
							>
								{t('agent.manage.reset')}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<div className="mt-2">
					<SegmentedControl
						value={scope}
						onChange={setScope}
						ariaLabel={t('agent.quick.scope')}
						size="sm"
						equalWidth
						options={[
							{ value: 'vault', label: t('agent.quick.vault') },
							{ value: 'all', label: t('agent.historyUI.allScope') },
						]}
					/>
				</div>
			</div>
			{state.error && (
				<p role="alert" className="p-3 text-xs text-destructive">
					{state.error}
				</p>
			)}
			{state.warnings.map((w) => (
				<p key={w} className="p-2 text-xs text-muted-foreground">
					{w}
				</p>
			))}
			<div ref={scroll} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
				<div className="relative w-full" style={{ height: virtual.getTotalSize() }}>
					{virtual.getVirtualItems().map((item) => {
						const row = rows[item.index]!;
						return (
							<div
								key={item.key}
								ref={virtual.measureElement}
								data-index={item.index}
								className="absolute left-0 top-0 w-full"
								style={{ transform: `translateY(${item.start}px)` }}
							>
								{'row' in row ? (
									<SessionRow row={row.row} controller={controller} />
								) : (
									<h4 className="flex h-8 items-center border-y border-sidebar-border bg-sidebar-accent/60 px-3 text-xs font-semibold">
										{row.label}
									</h4>
								)}
							</div>
						);
					})}
				</div>
				{!rows.length && !state.loading && (
					<p className="p-6 text-center text-xs text-muted-foreground">{t('agent.historyUI.empty')}</p>
				)}
			</div>
		</aside>
	);
}
