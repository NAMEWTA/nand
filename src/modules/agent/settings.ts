import { domainSettings } from '../../shared/settings/schema';
import { DEFAULT_TERMINAL_SETTINGS, normalizeTerminalSettings, type TerminalSettings } from './core/terminal/settings';

/** Settings namespace `agent`, stored in this device's file (shells, paths and logins differ per machine). */
export const agentSettings = domainSettings<TerminalSettings>({
	defaults: () => normalizeTerminalSettings(DEFAULT_TERMINAL_SETTINGS),
	normalize: normalizeTerminalSettings,
	scope: 'device',
});
