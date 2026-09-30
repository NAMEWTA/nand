import { Notice, type App } from 'obsidian';
import { AGENT_CATALOG } from '../../../core/agent-launch/catalog';
import { normalizeAgentSettings } from '../../../core/agent-launch/defaults';
import type { AgentId, AgentSettings, UsageSnapshot } from '../../../core/agent-launch/types';
import type { VaultSession } from '../../../core/ai-vault/types';
import { nextUsageDelayMs } from '../../../core/pty/path-reference';
import type { TerminalSettings } from '../../../core/pty/settings';
import { absolutePluginDir } from '../../../platform/desktop/agents/accounts';
import { resolveCli } from '../../../platform/desktop/agents/resolver';
import { runtimeProcess } from '../../../platform/desktop/agents/runtime-process';
import { readUsageSnapshots } from '../../../platform/desktop/agents/usage';
import type { TerminalService } from '../../../platform/desktop/terminal/terminal-service';
import { usageContext } from '../../../platform/obsidian/agents/usage-context';
import { onLanguageChanged, t } from '../../../shared/i18n/index';
import { openUsage } from '../../../view/agent-usage/open-usage';
import { paintUsageBar, renderUsageBar, usageBarVisible } from '../../../view/agent-usage/usage-bar';
import { UsageModal } from '../../../view/agent-usage/usage-modal';
import { launchAgent, launchShell, resumeAgent, type LaunchHost } from './launcher';

export interface OrcaPluginHost {
	app: App;
	settings: TerminalSettings;
	manifest: { dir?: string };
	saveSettings: () => Promise<void>;
	addCommand: (command: { id: string; nameKey?: string; name: string; callback: () => void }) => void;
	addStatusBarItem: () => HTMLElement;
	registerInterval: (id: number) => number;
	getTerminalService: () => Promise<TerminalService>;
	openFreshTerminal: () => Promise<void>;
	insertIntoActiveTerminal: (text: string) => Promise<boolean>;
	openSettings: () => void;
	readAbsoluteReference: () => string | null;
	noteLocalVersion?: (agentId: AgentId, version: string | null) => void;
	isActive?: () => boolean;
}

const refreshers = new WeakMap<OrcaPluginHost, () => void>();
export function launchRegisteredAgent(plugin: OrcaPluginHost, agentId: AgentId): Promise<void> {
	if (plugin.isActive && !plugin.isActive()) return Promise.reject(new Error(t('automation.agentUnavailable')));
	return launchAgent(host(plugin), agentId);
}
export function resumeRegisteredSession(plugin: OrcaPluginHost, session: VaultSession): Promise<void> {
	if (plugin.isActive && !plugin.isActive()) return Promise.reject(new Error(t('automation.agentUnavailable')));
	return resumeAgent(host(plugin), session);
}

export function refreshRegisteredUsage(plugin: OrcaPluginHost): void {
	refreshers.get(plugin)?.();
}

export function registerOrca(plugin: OrcaPluginHost): () => void {
	if (resolveCli('pwsh', '', ''))
		plugin.addCommand({
			id: 'new-terminal-powershell',
			nameKey: 'terminalAgent.commands.shellPowerShell',
			name: t('terminalAgent.commands.shellPowerShell'),
			callback: () => {
				void launchShell(host(plugin), 'pwsh', 'PowerShell');
			},
		});
	if (runtimeProcess().platform === 'win32')
		plugin.addCommand({
			id: 'new-terminal-cmd',
			nameKey: 'terminalAgent.commands.shellCmd',
			name: t('terminalAgent.commands.shellCmd'),
			callback: () => {
				void launchShell(host(plugin), 'cmd', 'Command Prompt');
			},
		});
	if (runtimeProcess().platform === 'win32')
		plugin.addCommand({
			id: 'new-terminal-gitbash',
			nameKey: 'terminalAgent.commands.shellGitBash',
			name: t('terminalAgent.commands.shellGitBash'),
			callback: () => {
				void launchShell(host(plugin), 'gitbash', 'Git Bash');
			},
		});

	plugin.addCommand({
		id: 'insert-absolute-reference',
		nameKey: 'terminalAgent.commands.insertAbsoluteReference',
		name: t('terminalAgent.commands.insertAbsoluteReference'),
		callback: () => {
			const text = plugin.readAbsoluteReference();
			if (!text) {
				new Notice(t('editor.copy.missing'));
				return;
			}
			const inline = text
				.split('\n')
				.filter((line) => line.length > 0)
				.join(' ');
			void plugin.insertIntoActiveTerminal(`${inline} `);
		},
	});

	plugin.addCommand({
		id: 'show-usage',
		nameKey: 'terminalAgent.commands.showUsage',
		name: t('terminalAgent.commands.showUsage'),
		callback: () => {
			void openUsage(plugin);
		},
	});

	plugin.addCommand({
		id: 'open-agent-settings',
		nameKey: 'terminalAgent.commands.agentSettings',
		name: t('terminalAgent.commands.agentSettings'),
		callback: () => plugin.openSettings(),
	});

	const status = plugin.addStatusBarItem();
	status.addClass('terminal-usage');
	status.addClass('is-clickable');
	let latest: UsageSnapshot[] = [];
	let inflight = false;
	let consecutiveFailures = 0;
	let nextAt = 0;
	let disposed = false;
	const render = async () => {
		if (disposed || inflight) return;
		inflight = true;
		try {
			const painted = await paintUsageBar(status, {
				settings: plugin.settings,
				isActive: () => !disposed && (!plugin.isActive || plugin.isActive()),
			}, (ids) => readUsageSnapshots(ids, usageContext(plugin)));
			if (painted) {
				latest = painted;
				consecutiveFailures = painted.some((snapshot) => snapshot.failed) ? consecutiveFailures + 1 : 0;
			}
		} finally {
			inflight = false;
			nextAt = Date.now() + nextUsageDelayMs(plugin.settings.agentSettings.usageRefreshSec, consecutiveFailures);
		}
	};
	refreshers.set(plugin, () => {
		void render();
	});
	const offLanguage = onLanguageChanged(() => renderUsageBar(status, plugin, latest));
	const onClick = () => {
		if (!usageBarVisible(plugin)) return;
		new UsageModal(plugin.app, latest).open();
		void render();
	};
	status.addEventListener('click', onClick);
	void render();
	const win = status.win;
	const timer = plugin.registerInterval(
		win.setInterval(() => {
			if (Date.now() < nextAt) return;
			void render();
		}, 15_000),
	);
	return () => {
		if (disposed) return;
		disposed = true;
		offLanguage();
		refreshers.delete(plugin);
		win.clearInterval(timer);
		status.removeEventListener('click', onClick);
		status.toggleClass('is-hidden', true);
		status.replaceChildren();
	};
}

function host(plugin: OrcaPluginHost): LaunchHost {
	return {
		app: plugin.app,
		getVaultPath: () => {
			const adapter = plugin.app.vault.adapter as { getBasePath?: () => string };
			return typeof adapter.getBasePath === 'function' ? adapter.getBasePath() : undefined;
		},
		getPluginDataDir: () =>
			absolutePluginDir(
				(plugin.app.vault.adapter as unknown as { getBasePath(): string }).getBasePath(),
				plugin.manifest.dir ?? '',
			),
		getAgentSettings: () => plugin.settings.agentSettings,
		saveAgentSettings: async (settings: AgentSettings) => {
			plugin.settings.agentSettings = normalizeAgentSettings(settings);
			await plugin.saveSettings();
		},
		queueSession: async (session) => {
			const service = await plugin.getTerminalService();
			service.queueSession(session);
		},
		openFreshTerminal: () => plugin.openFreshTerminal(),
		noteLocalVersion: plugin.noteLocalVersion,
	};
}

export function isAgentId(value: string): value is AgentId {
	return AGENT_CATALOG.some((agent) => agent.id === value);
}
