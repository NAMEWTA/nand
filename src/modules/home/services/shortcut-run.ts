import type { AgentDispatch, AgentQuickCommands } from '../../agent/api';
import { shortcutRunnable, type ShortcutButton } from '../core/board/shortcut-buttons';
import { t } from '../../../shared/i18n';
import { skillError } from './skill-shortcuts';

/** Everything a Shortcuts button can reach. Each is read when the button is pressed, so a gone target is noticed then. */
export interface ShortcutPorts {
	hasFile(path: string): boolean;
	openFile(path: string): Promise<void>;
	hasCommand(id: string): boolean;
	/** False when Obsidian did not run the command. */
	runCommand(id: string): boolean;
	/** Saved automations; undefined while the automations module is off. */
	automations(): { actions(): ReadonlyArray<{ id: string; unavailable?: string }>; run(id: string): Promise<void> } | undefined;
	/** The agent module's saved terminal quick commands; undefined while it is off. */
	quickCommands(): AgentQuickCommands | undefined;
	agents(): ReadonlyArray<{ id: string; enabled?: boolean; installed?: boolean }>;
	dispatch(): Promise<AgentDispatch | undefined>;
	notify(message: string): void;
	/** False once the board the button was pressed on has been left; nothing may start or be reported after that. */
	current(): boolean;
	/** Path of the board the button was pressed on, for the delivery's source. */
	boardPath: string;
	signal?: AbortSignal;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Run one Shortcuts button. The user configured it, so pressing it is the intent and nothing asks again; instead the
 * press is acknowledged ("Running…"), and a target that is gone or a failure is reported by name with the way out:
 * edit the shortcut.
 */
export async function runShortcut(button: ShortcutButton, ports: ShortcutPorts): Promise<void> {
	const name = button.label || button.target || t('home.widget.shortcuts'),
		alive = () => !ports.signal?.aborted && ports.current(),
		say = (key: string, detail = '') => {
			if (alive()) ports.notify(t(key, { name, detail }));
		};
	if (!alive()) return;
	if (!shortcutRunnable(button)) return say('shortcuts.incomplete');
	try {
		switch (button.type) {
			case 'file':
				if (!ports.hasFile(button.target)) return say('shortcuts.missing.file');
				return await ports.openFile(button.target);
			case 'command':
				if (!ports.hasCommand(button.target)) return say('shortcuts.missing.command');
				say('shortcuts.running');
				if (alive() && !ports.runCommand(button.target)) say('shortcuts.failed.command');
				return;
			case 'automation': {
				const automations = ports.automations();
				if (!automations) return say('shortcuts.unavailable.automation');
				const action = automations.actions().find((item) => item.id === button.target);
				if (!action) return say('shortcuts.missing.automation');
				if (action.unavailable) return say('shortcuts.failed', action.unavailable);
				say('shortcuts.running');
				if (!alive()) return;
				return await automations.run(button.target);
			}
			case 'quick': {
				const quick = ports.quickCommands();
				if (!quick) return say('shortcuts.unavailable.quick');
				if (!quick.list().some((item) => item.id === button.target)) return say('shortcuts.missing.quick');
				say('shortcuts.starting');
				if (!alive()) return;
				return await quick.run(button.target);
			}
			case 'agent': {
				if (!ports.agents().some((agent) => agent.id === button.agentId && agent.enabled !== false && agent.installed !== false))
					return say('shortcuts.missing.agent');
				const dispatch = await ports.dispatch();
				if (!alive()) return;
				if (!dispatch) return say('shortcuts.unavailable.agent');
				say('shortcuts.starting');
				const receipt = await dispatch.dispatch(
					{
						invocationId: crypto.randomUUID(),
						title: button.label || button.agentId!,
						source: { kind: 'widget', path: ports.boardPath, id: 'shortcuts' },
						agentId: button.agentId!,
						destination: { kind: 'fresh', cwd: '' },
						finalPrompt: button.prompt!,
						files: [],
					},
					{ signal: ports.signal },
				);
				if (!alive()) return;
				ports.notify(
					receipt.delivery === 'pasted'
						? t('home.skills.pasted')
						: receipt.delivery === 'started'
							? t('home.skills.started')
							: skillError(receipt.errorCode ?? receipt.delivery),
				);
			}
		}
	} catch (error) {
		say('shortcuts.failed', button.type === 'agent' ? skillError(error) : errorText(error));
	}
}
