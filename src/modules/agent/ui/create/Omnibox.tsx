// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/tab-bar/TabBarCreateEntry.tsx, TabBarCreateEntryRow.tsx, tab-bar-surface.tsx
import { Command } from 'cmdk';
import { ArrowLeft, Bot, ChevronRight, Globe, Loader2, Search, Settings, TerminalSquare } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { Platform } from 'obsidian';
import { useStore } from 'zustand';
import type { AgentController } from '../../services/controller';
import { AgentIcon } from '../../../../ui/components/nand/AgentIcon';
import { useT } from '../../../../ui/react/hooks';
import { classifyInput, matchingAgents, type InputAction } from './classify-input';
import type { ShellChoice } from '../../core/terminal/settings';

interface Option {
	id: string;
	label: string;
	detail?: string;
	icon: typeof Bot;
	action:
		| InputAction
		| { kind: 'tab'; tabId: string }
		| { kind: 'settings' }
		| { kind: 'shells' | 'back' }
		| { kind: 'shell'; shell: ShellChoice };
	shortcut?: string;
}
export function Omnibox({
	controller,
	groupId,
	onDone,
}: {
	controller: AgentController;
	groupId?: string;
	onDone: () => void;
}) {
	const t = useT(),
		workspace = controller.workspace;
	const state = useStore(workspace.store),
		[query, setQuery] = useState(''),
		[pending, setPending] = useState<string>(),
		[error, setError] = useState(''),
		[shellMenu, setShellMenu] = useState(false);
	const mod = Platform.isMacOS ? '⌘' : 'Ctrl';
	const detected = useMemo(() => controller.runtime.listAgents(), [controller]);
	const agents = useMemo(
		() =>
			detected
				.filter((a) => a.enabled && a.installed)
				.map((a) => ({
					...a,
					command: controller.settings.get().agents.agents[a.id].cliPath.split(/[\\/]/).at(-1),
				})),
		[controller, detected],
	);
	const actionOption = (action: InputAction): Option => ({
		id: JSON.stringify(action),
		action,
		icon:
			action.kind === 'agent'
				? Bot
				: action.kind === 'search'
					? Search
					: action.kind === 'terminal'
						? TerminalSquare
						: Globe,
		label:
			action.kind === 'agent'
				? controller.agentTitle(action.agentId)
				: t(
						`agent.workspace.${action.kind === 'url' ? 'openUrl' : action.kind === 'search' ? 'searchWeb' : action.kind === 'terminal' ? 'newTerminal' : 'newBrowser'}`,
					),
		detail: action.kind === 'url' ? action.url : action.kind === 'search' ? action.query : undefined,
	});
	const options: Option[] = [];
	const shells = controller.shells().filter((s) => s.choice !== 'default');
	if (controller.settings.get().customShellPath?.trim())
		shells.push({ choice: 'custom', title: t('agent.workspace.customShell') });
	if (query.trim()) {
		if (!query.trim().startsWith('?')) {
			const q = query.trim().toLocaleLowerCase();
			const group = state.groups.find((g) => g.id === groupId);
			const tabIds = [...(group?.recentTabIds ?? []), ...state.groups.flatMap((g) => g.tabIds)];
			for (const id of [...new Set(tabIds)]) {
				const tab = state.tabs[id];
				if (!tab) continue;
				if (
					`${tab.customTitle || tab.title} ${
						tab.kind === 'browser'
							? tab.url
							: Object.values(tab.panes)
									.map((p) => p.cwd)
									.join(' ')
					}`
						.toLocaleLowerCase()
						.includes(q)
				)
					options.push({
						id: `tab:${id}`,
						action: { kind: 'tab', tabId: id },
						label: t('agent.workspace.switchTab'),
						detail: tab.customTitle || tab.title,
						icon: tab.kind === 'browser' ? Globe : TerminalSquare,
					});
			}
		}
		const classified = classifyInput(query, agents);
		options.push(actionOption(classified));
		for (const agent of matchingAgents(query, agents))
			if (classified.kind !== 'agent' || classified.agentId !== agent.id)
				options.push(actionOption({ kind: 'agent', agentId: agent.id }));
	} else {
		options.push({ ...actionOption({ kind: 'terminal' }), shortcut: `${mod} T` });
		if (Platform.isWin || shellMenu)
			for (const shell of shells)
				options.push({
					id: `shell:${shell.choice}`,
					action: { kind: 'shell', shell: shell.choice },
					label: Platform.isWin ? `${t('agent.workspace.newTerminal')}: ${shell.title}` : shell.title,
					icon: TerminalSquare,
				});
		else if (shells.length)
			options.push({
				id: 'shells',
				action: { kind: 'shells' },
				label: t('agent.workspace.otherShells'),
				icon: ChevronRight,
			});
		if (workspace.browserAvailable) options.push({ ...actionOption({ kind: 'browser' }), shortcut: `${mod} ⇧B` });
		for (const [i, agent] of agents.entries())
			options.push({
				...actionOption({ kind: 'agent', agentId: agent.id }),
				shortcut: i === 0 ? `${mod} Alt N` : undefined,
			});
		options.push({
			id: 'settings',
			action: { kind: 'settings' },
			label: t('agent.workspace.agentSettings'),
			icon: Settings,
		});
	}
	if (shellMenu && !query.trim()) {
		const choices = options.filter((o) => o.action.kind === 'shell');
		options.splice(
			0,
			options.length,
			{ id: 'back', action: { kind: 'back' }, label: t('agent.workspace.back'), icon: ArrowLeft },
			...choices,
		);
	}
	const execute = async (option: Option) => {
		if (option.action.kind === 'shells' || option.action.kind === 'back') {
			setShellMenu(option.action.kind === 'shells');
			return;
		}
		if (pending) return;
		setPending(option.id);
		setError('');
		try {
			const action = option.action;
			if (action.kind === 'tab') workspace.activate(action.tabId);
			else if (action.kind === 'terminal' || action.kind === 'shell')
				await workspace.newTerminal({ groupId, shell: action.kind === 'shell' ? action.shell : undefined });
			else if (action.kind === 'agent') await workspace.newAgent(action.agentId, { groupId });
			else if (action.kind === 'settings') await controller.open({ feature: 'settings', section: 'agent' });
			else
				workspace.newBrowser(
					action.kind === 'url' ? action.url : action.kind === 'search' ? `?${action.query}` : undefined,
					{ groupId },
				);
			onDone();
		} catch (error) {
			setError(error instanceof Error ? error.message : String(error));
		} finally {
			setPending(undefined);
		}
	};
	return (
		<Command
			loop
			shouldFilter={false}
			className="w-full"
			onKeyDown={(event) => {
				event.stopPropagation();
				if (event.nativeEvent.isComposing) {
					event.preventDefault();
					return;
				}
			}}
		>
			<Command.Input
				autoFocus
				value={query}
				onValueChange={setQuery}
				readOnly={!!pending}
				placeholder={t('agent.workspace.omnibox')}
				aria-label={t('agent.workspace.omnibox')}
				className="h-9 w-full border-0 bg-transparent px-2 text-xs outline-none"
			/>
			{error && (
				<p role="alert" className="px-2 py-1 text-xs text-destructive">
					{error}
				</p>
			)}
			<Command.List
				className="max-h-80 overflow-y-auto border-t border-border p-1"
				aria-label={t('agent.workspace.newTab')}
			>
				{(() => {
					const groups: { id: string; options: Option[] }[] = [];
					for (const option of options) {
						const kind = option.action.kind;
						const id =
							kind === 'settings'
								? 'settings'
								: kind === 'agent'
									? 'agents'
									: kind === 'tab'
										? 'tabs'
										: 'actions';
						const previous = groups.at(-1);
						if (previous?.id === id) previous.options.push(option);
						else groups.push({ id, options: [option] });
					}
					if (!query && !shellMenu && !agents.length)
						groups.splice(groups.length - 1, 0, { id: 'agents', options: [] });
					return groups.map((group, index) => (
						<Fragment key={`${group.id}-${index}`}>
							{index > 0 && <Command.Separator alwaysRender className="-mx-1 my-1 h-px bg-border" />}
							<Command.Group
								heading={<span className="sr-only">{t(`agent.workspace.menu.${group.id}`)}</span>}
							>
								{group.options.map((option) => (
									<Command.Item
										key={option.id}
										value={option.id}
										disabled={!!pending}
										onSelect={() => {
											void execute(option);
										}}
										className={`flex min-h-6 cursor-pointer items-center rounded-[7px] text-left leading-5 text-muted-foreground outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 ${query.trim() ? 'gap-1.5 px-1 py-1 text-[11px]' : 'gap-2 px-2 py-1.5 text-xs font-medium'}`}
									>
										{pending === option.id ? (
											<Loader2 className="size-3.5 shrink-0 animate-spin" />
										) : option.action.kind === 'agent' ? (
											<AgentIcon agent={option.action.agentId} size={14} />
										) : (
											<option.icon className="size-3.5 shrink-0" />
										)}
										<span className="min-w-0 truncate font-medium">{option.label}</span>
										{option.detail && (
											<>
												<span aria-hidden="true">·</span>
												<span className="min-w-0 flex-1 truncate">{option.detail}</span>
											</>
										)}
										{option.shortcut && (
											<span className="ml-auto text-[10px] text-muted-foreground">
												{option.shortcut}
											</span>
										)}
									</Command.Item>
								))}
								{group.id === 'agents' && !group.options.length && (
									<div className="px-2 py-1.5 text-xs text-muted-foreground">
										{t(
											detected.some((a) => a.installed)
												? 'agent.workspace.noEnabledAgents'
												: 'agent.workspace.noAgents',
										)}
									</div>
								)}
							</Command.Group>
						</Fragment>
					));
				})()}
			</Command.List>
		</Command>
	);
}
