// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/WorktreeJumpPalette.tsx
import { useState } from 'react';
import { useStore } from 'zustand';
import {
	CommandDialog,
	CommandInput,
	CommandList,
	CommandGroup,
	CommandItem,
	CommandEmpty,
} from '../../../../ui/components/command';
import { AgentIcon } from '../../../../ui/components/nand/AgentIcon';
import { StatusDot } from '../../../../ui/components/nand/StatusDot';
import { useT } from '../../../../ui/react/hooks';
import type { AgentController } from '../../services/controller';
import type { HistoryRow } from '../../services/history-store';
export function JumpPalette({
	controller,
	close,
	select,
}: {
	controller: AgentController;
	close: () => void;
	select: (id: string) => void;
}) {
	const t = useT(),
		state = useStore(controller.workspace.store),
		history = useStore(controller.historyStore.store),
		[query, setQuery] = useState('');
	const score = (id: string) => {
		const tab = state.tabs[id];
		return tab?.kind === 'terminal'
			? ['waiting', 'permission'].includes(tab.state)
				? 0
				: tab.state === 'done'
					? 1
					: 2
			: 3;
	};
	const tabs = Object.values(state.tabs)
		.sort((a, b) => score(a.id) - score(b.id) || b.createdAt - a.createdAt)
		.filter((tab) =>
			[tab.customTitle, tab.title, tab.kind === 'terminal' ? tab.panes[tab.focusedSessionId]?.cwd : tab.url]
				.join(' ')
				.toLowerCase()
				.includes(query.toLowerCase()),
		)
		.slice(0, query ? 100 : 6);
	const choose = (id: string, split = false) => {
		if (split) {
			const group = controller.workspace.store.getState().activeGroupId;
			if (group) controller.workspace.move(id, { split: 'right', ofGroupId: group });
		}
		select(id);
		close();
	};
	const reopen = (id: string, split = false) => {
		controller.workspace.reopen(id);
		choose(id, split);
	};
	const resume = (row: HistoryRow, split = false) => {
		const group = controller.workspace.store.getState().activeGroupId;
		close();
		void (split ? controller.resumeAt(row, group ?? undefined, 'right') : controller.resume(row)).catch((e) =>
			controller.workspace.report(e),
		);
	};
	return (
		<CommandDialog
			open
			onOpenChange={(open) => {
				if (!open) close();
			}}
			title={t('agent.jump.title')}
		>
			<div
				onKeyDownCapture={(e) => {
					if (e.nativeEvent.isComposing) return;
					if ((e.ctrlKey || e.metaKey) && /^[1-6]$/.test(e.key)) {
						const tab = tabs[Number(e.key) - 1];
						if (tab) {
							e.preventDefault();
							choose(tab.id);
						}
					}
					if (e.shiftKey && e.key === 'Enter') {
						const item = e.currentTarget.querySelector('[cmdk-item][data-selected="true"]');
						const id = item?.getAttribute('data-tab-id'),
							closed = item?.getAttribute('data-closed-id'),
							row = history.rows.find((row) => row.key === item?.getAttribute('data-history-key'));
						if (id || closed || row) {
							e.preventDefault();
							e.stopPropagation();
							if (id) choose(id, true);
							else if (closed) reopen(closed, true);
							else if (row) resume(row, true);
						}
					}
				}}
			>
				<CommandInput value={query} onValueChange={setQuery} placeholder={t('agent.search')} />
				<CommandList>
					<CommandEmpty>{t('agent.historyUI.empty')}</CommandEmpty>
					<CommandGroup heading={t('agent.jump.recent')}>
						{tabs.map((tab, index) => (
							<CommandItem
								key={tab.id}
								value={`tab ${tab.id} ${tab.title} ${query}`}
								data-tab-id={tab.id}
								onSelect={() => choose(tab.id)}
							>
								<AgentIcon
									agent={tab.kind === 'terminal' ? tab.agentId || 'terminal' : 'browser'}
									size={14}
								/>
								{tab.kind === 'terminal' && tab.agentId && <StatusDot state={tab.state} />}
								<span className="min-w-0 flex-1 truncate">{tab.customTitle || tab.title}</span>
								{!query && <span className="text-xs text-muted-foreground">{index + 1}</span>}
							</CommandItem>
						))}
					</CommandGroup>
					{!query && (
						<CommandGroup heading={t('agent.jump.closed')}>
							{state.closedTabs.slice(0, 6).map((tab) => (
								<CommandItem key={tab.id} data-closed-id={tab.id} onSelect={() => reopen(tab.id)}>
									{tab.customTitle || tab.title}
								</CommandItem>
							))}
						</CommandGroup>
					)}
					{query && (
						<CommandGroup heading={t('agent.history')}>
							{history.rows
								.filter((row) => `${row.title} ${row.cwd}`.toLowerCase().includes(query.toLowerCase()))
								.slice(0, 20)
								.map((row) => (
									<CommandItem
										key={row.key}
										value={`${row.key} ${query}`}
										data-history-key={row.key}
										onSelect={() => resume(row)}
									>
										{row.metadata.title || row.title}
									</CommandItem>
								))}
						</CommandGroup>
					)}
					<CommandGroup heading={t('agent.jump.commands')}>
						<CommandItem
							onSelect={() => {
								close();
								void controller.workspace.newTerminal().catch((e) => controller.workspace.report(e));
							}}
						>
							{t('agent.workspace.newTerminal')}
						</CommandItem>
						{controller.workspace.browserAvailable && (
							<CommandItem
								onSelect={() => {
									close();
									controller.workspace.newBrowser();
								}}
							>
								{t('agent.workspace.newBrowser')}
							</CommandItem>
						)}
						<CommandItem
							onSelect={() => {
								close();
								void controller.open({ feature: 'settings', section: 'terminal' });
							}}
						>
							{t('agent.workspace.agentSettings')}
						</CommandItem>
					</CommandGroup>
				</CommandList>
			</div>
		</CommandDialog>
	);
}
