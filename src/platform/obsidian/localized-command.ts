import type { Command, Plugin } from 'obsidian';
import { onLanguageChanged, t } from '../../shared/i18n';

export type LocalizedCommand = Command & { nameKey?: string; nameResolver?: () => string };

/** Update the registered object so IDs, hotkeys and callbacks keep their native identity. */
export function registerLocalizedCommand(
	host: Pick<Plugin, 'manifest' | 'register'>,
	command: LocalizedCommand,
	addNative: (command: Command) => Command,
): Command {
	const { nameKey, nameResolver, ...native } = command;
	const resolve = nameResolver ?? (nameKey ? () => t(nameKey) : undefined);
	const registered = addNative({ ...native, name: resolve?.() ?? native.name });
	if (resolve)
		host.register(
			onLanguageChanged(() => {
				registered.name = `${host.manifest.name}: ${resolve()}`;
			}),
		);
	return registered;
}
