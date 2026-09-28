import { type App } from 'obsidian';
import type { TerminalSettings } from '../../../core/pty/settings';
import { absolutePluginDir } from '../../desktop/agents/accounts';

export function usageContext(plugin: { app: App; manifest: { dir?: string }; settings: TerminalSettings }) {
	const adapter = plugin.app.vault.adapter as unknown as { getBasePath(): string };
	return {
		settings: plugin.settings.agentSettings,
		pluginDir: absolutePluginDir(adapter.getBasePath(), plugin.manifest.dir ?? ''),
	};
}
