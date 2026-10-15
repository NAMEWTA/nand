// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/terminal-quick-commands/TerminalQuickCommandDialog.tsx
import { useState } from 'react';
import { Button } from '../../../../ui/components/button';
import { SettingsSection } from '../../../../ui/components/nand/SettingsSection';
import { useT } from '../../../../ui/react/hooks';
import type { QuickCommand } from '../../core/terminal/settings';
import type { AgentController } from '../../services/controller';
import { newQuickCommand, QuickCommandEditor } from '../quick-commands/QuickCommandEditor';
import { useAgentSettings } from './settings-context';
export function QuickCommandsSection({ controller }: { controller: AgentController }) {
	const t = useT(),
		settings = useAgentSettings(controller.settings),
		[edit, setEdit] = useState<QuickCommand>();
	return (
		<SettingsSection title={t('agent.quick.title')}>
			<div className="divide-y divide-border/40">
				{settings.quickCommands.map((command) => (
					<div key={command.id} className="flex flex-wrap items-center gap-2 py-3">
						<div className="min-w-0 flex-1">
							<p className="text-sm font-medium">{command.name}</p>
							<p className="truncate font-mono text-xs text-muted-foreground">{command.content}</p>
						</div>
						<Button
							variant="ghost"
							size="xs"
							onClick={() => {
								void controller.runQuickCommand(command).catch((e) => controller.workspace.report(e));
							}}
						>
							{t('agent.quick.run')}
						</Button>
						<Button variant="ghost" size="xs" onClick={() => setEdit(command)}>
							{t('agent.quick.edit')}
						</Button>
						<Button
							variant="ghost"
							size="xs"
							onClick={() => {
								void controller.settings
									.update((d) => {
										d.quickCommands = d.quickCommands.filter((c) => c.id !== command.id);
									})
									.catch((e) => controller.workspace.report(e));
							}}
						>
							{t('agent.manage.remove')}
						</Button>
					</div>
				))}
			</div>
			<Button variant="outline" onClick={() => setEdit(newQuickCommand())}>
				{t('agent.quick.add')}
			</Button>
			{edit && <QuickCommandEditor command={edit} controller={controller} close={() => setEdit(undefined)} />}
		</SettingsSection>
	);
}
