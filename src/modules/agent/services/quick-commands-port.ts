import type { SettingsHandle } from '../../../shared/settings/store';
import type { AgentQuickCommands } from '../api';
import type { TerminalSettings } from '../core/terminal/settings';
import type { AgentController } from './controller';

/** The saved terminal quick commands for other modules; running goes through the controller like the terminal's own menu. */
export function quickCommandsPort(
	controller: Pick<AgentController, 'runQuickCommand'>,
	settings: Pick<SettingsHandle<TerminalSettings>, 'get' | 'subscribe'>,
): AgentQuickCommands {
	return {
		list: () =>
			settings.get().quickCommands.map((command) => ({
				id: command.id,
				name: command.name,
				type: command.type,
				scope: command.scope,
				...(command.type === 'agent' ? { agentId: command.agentId } : {}),
			})),
		subscribe: (listener) => settings.subscribe(listener),
		async run(id) {
			const command = settings.get().quickCommands.find((item) => item.id === id);
			if (!command) throw new Error('missing');
			await controller.runQuickCommand(command);
		},
	};
}
