// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/dashboard/AgentDashboardDrawer.tsx, DashboardAgentRow.tsx, sidebar/WorkspaceKanbanCard.tsx
import { useState, useEffect } from 'react';
import { useStore } from 'zustand';
import { Settings, ListFilter } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
} from '../../../../ui/components/dropdown-menu';
import { StatusDot } from '../../../../ui/components/nand/StatusDot';
import { AgentIcon } from '../../../../ui/components/nand/AgentIcon';
import { useOwnerDocument, useVisible } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { cn } from '../../../../ui/lib/utils';
import { AGENT_CATALOG } from '../../core/launch/catalog';
import { sessionBucket } from '../../core/workspace/sidebar';
import type { TerminalTabData } from '../../core/workspace/model';
import type { AgentController } from '../../services/controller';
import { shortPath } from '../sidebar/AgentSidebar';
export function AgentBoard({ controller, select }: { controller: AgentController; select: (id: string) => void }) {
	const t = useT(),
		state = useStore(controller.workspace.store),
		[query, setQuery] = useState(''),
		[idle, setIdle] = useState(false),
		[agents, setAgents] = useState(AGENT_CATALOG.map((a) => a.id as string));
	useEffect(() => {
		void controller.historyStore.refresh(false);
	}, [controller]);
	const tabs = Object.values(state.tabs).filter(
		(tab): tab is TerminalTabData =>
			tab.kind === 'terminal' &&
			!!tab.agentId &&
			agents.includes(tab.agentId) &&
			[tab.title, tab.customTitle, tab.panes[tab.focusedSessionId]?.cwd, tab.agentId]
				.join(' ')
				.toLowerCase()
				.includes(query.toLowerCase()),
	);
	const bucket = (tab: TerminalTabData) => {
		const value = sessionBucket(tab);
		return value === 'unknown' ? 'idle' : value;
	};
	return (
		<div className="flex h-full min-h-0 flex-1 flex-col" data-agent-board="">
			<div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
				<h2 className="mr-auto text-sm font-semibold">{t('agent.workspace.nav.board')}</h2>
				<Input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={t('agent.search')}
					aria-label={t('agent.search')}
					className="h-8 w-48 text-xs"
				/>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon-sm" aria-label={t('agent.historyUI.agents')}>
							<ListFilter className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						{AGENT_CATALOG.map((a) => (
							<DropdownMenuCheckboxItem
								key={a.id}
								checked={agents.includes(a.id)}
								onSelect={(e) => e.preventDefault()}
								onCheckedChange={(v) =>
									setAgents((old) => (v ? [...old, a.id] : old.filter((x) => x !== a.id)))
								}
							>
								{a.title}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon-sm" aria-label={t('agent.board.settings')}>
							<Settings className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuCheckboxItem checked={idle} onCheckedChange={setIdle}>
							{t('agent.board.showIdle')}
						</DropdownMenuCheckboxItem>
					</DropdownMenuContent>
				</DropdownMenu>
				{(query || agents.length !== AGENT_CATALOG.length) && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setQuery('');
							setAgents(AGENT_CATALOG.map((a) => a.id));
						}}
					>
						{t('agent.workspace.resetFilters')}
					</Button>
				)}
			</div>
			<div className="flex min-h-0 flex-1 gap-3 overflow-auto p-4">
				{['attention', 'working', 'done', ...(idle ? ['idle'] : [])].map((key) => (
					<section key={key} className="flex min-w-52 flex-1 flex-col gap-2">
						<h3 className="text-xs font-semibold text-muted-foreground">
							{t(`agent.workspace.bucket.${key}`)} · {tabs.filter((tab) => bucket(tab) === key).length}
						</h3>
						{tabs
							.filter((tab) => bucket(tab) === key)
							.map((tab) => (
								<BoardCard
									key={tab.id}
									tab={tab}
									controller={controller}
									select={() => select(tab.id)}
								/>
							))}
					</section>
				))}
			</div>
		</div>
	);
}
function BoardCard({
	tab,
	controller,
	select,
}: {
	tab: TerminalTabData;
	controller: AgentController;
	select: () => void;
}) {
	const doc = useOwnerDocument(),
		visible = useVisible(),
		[now, setNow] = useState(Date.now);
	useEffect(() => {
		const win = doc.defaultView;
		if (!win || !visible) return;
		const timer = win.setInterval(() => setNow(Date.now()), 60000);
		return () => win.clearInterval(timer);
	}, [doc, visible]);
	const t = useT(),
		[text, setText] = useState(''),
		session = controller.sessions.get(tab.focusedSessionId);
	const history = useStore(controller.historyStore.store);
	const preview =
		session?.lastMessage ||
		history.rows.find((row) => row.sessionId === tab.panes[tab.focusedSessionId]?.nativeSessionId)?.turns.at(-1)
			?.text;
	return (
		<article
			className={cn(
				'relative rounded-lg border border-border/50 bg-card p-3',
				['waiting', 'permission'].includes(tab.state) && 'bg-agent-question/8',
				tab.state === 'done' && 'bg-status-success/5',
			)}
		>
			<button type="button" className="flex w-full flex-col gap-2 text-left" onClick={select}>
				<span className="flex w-full items-center gap-2">
					<AgentIcon agent={tab.agentId!} size={14} />
					<span className="min-w-0 flex-1 truncate text-[13px] font-medium">
						{tab.customTitle || tab.title}
					</span>
					<StatusDot state={tab.state} />
				</span>
				<span className="line-clamp-2 text-xs text-muted-foreground">{preview || tab.title}</span>
				<span className="block w-full truncate text-[11px] text-muted-foreground">
					{shortPath(tab.panes[tab.focusedSessionId]?.cwd || '')} ·{' '}
					{now - tab.createdAt < 60000
						? t('agent.justNow')
						: t('agent.minutesAgo', { count: Math.floor((now - tab.createdAt) / 60000) })}
				</span>
			</button>
			<form
				className="mt-3 flex gap-1"
				onSubmit={(e) => {
					e.preventDefault();
					if (text.trim() && session?.running) {
						session.paste(text);
						session.input('\r');
						setText('');
					}
				}}
			>
				<Input
					value={text}
					onChange={(e) => setText(e.target.value)}
					aria-label={t('agent.board.message')}
					disabled={!session?.running}
					className="h-7 min-w-0 text-xs"
				/>
				<Button variant="ghost" size="xs" disabled={!session?.running || !text.trim()}>
					{t('agent.board.send')}
				</Button>
			</form>
		</article>
	);
}
