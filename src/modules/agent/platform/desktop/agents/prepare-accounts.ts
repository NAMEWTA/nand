import type { App } from 'obsidian';
import { bundledMain } from '../../../../../host/desktop/electron-main';
import { desktopVaultRoot } from '../../../../../host/obsidian/storage/private-storage';
import { deviceId } from '../../../../../host/obsidian/storage/device-id';
import { absolutePluginDir } from './accounts';
import { prepareLegacyAccounts, type LegacyAccountChoice } from './legacy-accounts';

export function prepareAccounts(app: App, plugin: string, choose: (options: LegacyAccountChoice) => Promise<string | null>): Promise<() => void> {
	if (!plugin) throw new Error('agent.pluginDirectoryMissing');
	const boot = bundledMain<{ boot: string }>(app.workspace.containerEl.win, `const key=Symbol.for('nand.agent.migration.boot');exports.boot=globalThis[key]??=require('node:crypto').randomUUID();`).boot;
	const vault = desktopVaultRoot(app);
	return prepareLegacyAccounts({ vault, device: deviceId(app), plugin: absolutePluginDir(vault, plugin), boot, choose });
}
