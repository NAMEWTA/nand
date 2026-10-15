// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/tab-bar/TabBarQuickCommandsMenu.tsx, TabBarQuickCommandsButton.tsx
import { useState } from 'react';
import { Play, ChevronDown, Copy } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from '../../../../ui/components/dropdown-menu';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import type { AgentController } from '../../services/controller';
import { useAgentSettings } from '../settings/settings-context';
import { newQuickCommand, QuickCommandEditor } from './QuickCommandEditor';
export function QuickCommandsButton({ controller, groupId }: { controller: AgentController; groupId?: string }) {
	const t = useT(),
		doc = useOwnerDocument(),
		settings = useAgentSettings(controller.settings),
		[editor, setEditor] = useState(false);
	const recent =
		settings.quickCommands.find((c) => c.id === settings.lastQuickCommand) ??
		settings.quickCommands.find((c) => c.scope === 'vault') ??
		settings.quickCommands[0];
	const run = (id: string) => {
		const cmd = settings.quickCommands.find((c) => c.id === id);
		if (cmd) void controller.runQuickCommand(cmd, groupId).catch((e) => controller.workspace.report(e));
	};
	return (
		<>
			<div className="my-auto flex h-7 shrink-0 items-center rounded-md text-muted-foreground">
				<Button
					variant="ghost"
					size="xs"
					className="h-7 max-w-28 gap-1 rounded-r-none px-1.5"
					onClick={() => (recent ? run(recent.id) : setEditor(true))}
				>
					<Play className="size-3.5" />
					<span className="truncate text-[12px] font-medium">{recent?.name || t('agent.quick.title')}</span>
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon-xs"
							className="h-7 rounded-l-none"
							aria-label={t('agent.quick.menu')}
						>
							<ChevronDown className="size-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-72">
						{(['global', 'vault'] as const).map((scope) => (
							<div key={scope}>
								<DropdownMenuLabel>{t(`agent.quick.${scope}`)}</DropdownMenuLabel>
								{settings.quickCommands
									.filter((c) => c.scope === scope)
									.map((c) => (
										<div key={c.id} className="flex items-center">
											<DropdownMenuItem className="min-w-0 flex-1" onSelect={() => run(c.id)}>
												{c.name}
											</DropdownMenuItem>
											<DropdownMenuItem
												aria-label={t('agent.quick.copy', { name: c.name })}
												onSelect={(e) => {
													e.preventDefault();
													void doc.defaultView?.navigator.clipboard
														.writeText(c.content)
														.catch((error) => controller.workspace.report(error));
												}}
											>
												<Copy className="size-3" />
											</DropdownMenuItem>
										</div>
									))}
							</div>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => setEditor(true)}>{t('agent.quick.add')}</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => {
								void controller.open({ feature: 'settings', section: 'terminal', resourceId: 'quick' });
							}}
						>
							{t('agent.quick.manage')}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			{editor && (
				<QuickCommandEditor
					command={newQuickCommand()}
					controller={controller}
					close={() => setEditor(false)}
				/>
			)}
		</>
	);
}
