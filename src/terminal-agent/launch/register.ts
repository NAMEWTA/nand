import { runtimeProcess } from './runtime-process';
import { resolveCli } from './resolver';
import { absolutePluginDir } from './accounts';
import { Notice, Setting, type App } from 'obsidian';
import { t } from '../../shared/i18n';
import type { TerminalSettings } from '../settings/model';
import { normalizeAgentSettings } from './defaults';
import { AGENT_CATALOG } from './catalog';
import { launchAgent, launchShell, resumeAgent, type LaunchHost } from './launcher';
import { nextUsageDelayMs } from '../terminal/path-reference';
import { readUsageSnapshots } from './usage';
import { enabledUsageAgents, paintUsageBar, usageBarVisible } from './usage-bar';
import type { VaultSession } from '../sessions/types';
import { UsageModal } from './usage-modal';
import type { AgentId, AgentSettings, UsageSnapshot } from './types';
import type { TerminalService } from '../terminal/terminal-service';

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

export function usageContext(plugin: Pick<OrcaPluginHost, 'app' | 'manifest' | 'settings'>) {
  const adapter = plugin.app.vault.adapter as unknown as { getBasePath(): string };
  return { settings: plugin.settings.agentSettings, pluginDir: absolutePluginDir(adapter.getBasePath(), plugin.manifest.dir ?? '') };
}

async function openUsage(plugin: OrcaPluginHost): Promise<void> {
  if (!usageBarVisible(plugin)) return;
  const snapshots = await readUsageSnapshots(enabledUsageAgents(plugin), usageContext(plugin));
  new UsageModal(plugin.app, snapshots).open();
}

export function refreshRegisteredUsage(plugin: OrcaPluginHost): void {
  refreshers.get(plugin)?.();
}

export function registerOrca(plugin: OrcaPluginHost): void {
  if (resolveCli('pwsh', '', '')) plugin.addCommand({
    id: 'new-terminal-powershell',
    nameKey: 'terminalAgent.commands.shellPowerShell', name: t('terminalAgent.commands.shellPowerShell'),
    callback: () => {
      void launchShell(host(plugin), 'pwsh', 'PowerShell');
    },
  });
  if (runtimeProcess().platform === 'win32') plugin.addCommand({
    id: 'new-terminal-cmd',
    nameKey: 'terminalAgent.commands.shellCmd', name: t('terminalAgent.commands.shellCmd'),
    callback: () => {
      void launchShell(host(plugin), 'cmd', 'Command Prompt');
    },
  });
  if (runtimeProcess().platform === 'win32') plugin.addCommand({
    id: 'new-terminal-gitbash',
    nameKey: 'terminalAgent.commands.shellGitBash', name: t('terminalAgent.commands.shellGitBash'),
    callback: () => {
      void launchShell(host(plugin), 'gitbash', 'Git Bash');
    },
  });

  plugin.addCommand({
    id: 'insert-absolute-reference',
    nameKey: 'terminalAgent.commands.insertAbsoluteReference', name: t('terminalAgent.commands.insertAbsoluteReference'),
    callback: () => {
      const text = plugin.readAbsoluteReference();
      if (!text) {
        new Notice(t('editor.copy.missing'));
        return;
      }
      const inline = text.split('\n').filter((line) => line.length > 0).join(' ');
      void plugin.insertIntoActiveTerminal(`${inline} `);
    },
  });

  plugin.addCommand({
    id: 'show-usage',
    nameKey: 'terminalAgent.commands.showUsage', name: t('terminalAgent.commands.showUsage'),
    callback: () => {
      void openUsage(plugin);
    },
  });

  plugin.addCommand({
    id: 'open-agent-settings',
    nameKey: 'terminalAgent.commands.agentSettings', name: t('terminalAgent.commands.agentSettings'),
    callback: () => plugin.openSettings(),
  });

  const status = plugin.addStatusBarItem();
  status.addClass('terminal-usage');
  status.addClass('is-clickable');
  let latest: UsageSnapshot[] = [];
  let inflight = false;
  let consecutiveFailures = 0;
  let nextAt = 0;
  const render = async () => {
    if (inflight) return;
    inflight = true;
    try {
      const painted = await paintUsageBar(status, plugin, (ids) => readUsageSnapshots(ids, usageContext(plugin)));
      if (painted) {
        latest = painted;
        consecutiveFailures = painted.some((snapshot) => snapshot.failed) ? consecutiveFailures + 1 : 0;
      }
    } finally {
      inflight = false;
      nextAt = Date.now() + nextUsageDelayMs(plugin.settings.agentSettings.usageRefreshSec, consecutiveFailures);
    }
  };
  refreshers.set(plugin, () => { void render(); });
  status.addEventListener('click', () => {
    if (!usageBarVisible(plugin)) return;
    new UsageModal(plugin.app, latest).open();
    void render();
  });
  void render();
  plugin.registerInterval(window.setInterval(() => {
    if (Date.now() < nextAt) return;
    void render();
  }, 15_000));
}

function host(plugin: OrcaPluginHost): LaunchHost {
  return {
    app: plugin.app,
    getVaultPath: () => {
      const adapter = plugin.app.vault.adapter as { getBasePath?: () => string };
      return typeof adapter.getBasePath === 'function' ? adapter.getBasePath() : undefined;
    },
    getPluginDataDir: () => absolutePluginDir((plugin.app.vault.adapter as unknown as { getBasePath(): string }).getBasePath(), plugin.manifest.dir ?? ''),
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

export function renderAgentSettings(containerEl: HTMLElement, plugin: OrcaPluginHost): void {
  containerEl.addClass('terminal-agent-settings');
  new Setting(containerEl).setName(t('terminalAgent.agents.heading')).setDesc(t('terminalAgent.agents.intro')).setHeading();

  new Setting(containerEl)
    .setName(t('terminalAgent.agents.permission'))
    .setDesc(t('terminalAgent.agents.permissionDesc'))
    .addDropdown((dropdown) => {
      dropdown
        .addOption('yolo', 'YOLO')
        .addOption('manual', 'Manual')
        .setValue(plugin.settings.agentSettings.globalPermissionMode)
        .onChange(async (value) => {
          plugin.settings.agentSettings.globalPermissionMode = value === 'manual' ? 'manual' : 'yolo';
          await plugin.saveSettings();
        });
    });

  for (const agent of AGENT_CATALOG) {
    const entry = plugin.settings.agentSettings.agents[agent.id];
    const group = containerEl.createDiv({ cls: 'terminal-agent-settings-group' });
    new Setting(group)
      .setName(agent.title)
      .setHeading();
    group.createEl('a', { cls: 'terminal-agent-docs', text: t('terminalAgent.agents.documentation'), href: agent.installDocsUrl });
    const cli = new Setting(group)
      .setName(t('terminalAgent.agents.cliPath'))
      .setDesc(t('terminalAgent.agents.cliPlaceholder'))
      .addText((text) => {
        text
          .setPlaceholder(t('terminalAgent.agents.cliPlaceholder'))
          .setValue(entry.cliPath)
          .onChange(async (value) => {
            plugin.settings.agentSettings.agents[agent.id].cliPath = value.trim();
            await plugin.saveSettings();
          });
      });
    cli.settingEl.addClass('terminal-agent-command-setting');
    new Setting(group)
      .setName(t('terminalAgent.agents.agentPermission'))
      .addDropdown((dropdown) => {
        dropdown
          .addOption('inherit', t('terminalAgent.agents.followGlobal'))
          .addOption('yolo', 'YOLO')
          .addOption('manual', 'Manual')
          .setValue(entry.permissionMode)
          .onChange(async (value) => {
            const mode = value === 'yolo' || value === 'manual' ? value : 'inherit';
            plugin.settings.agentSettings.agents[agent.id].permissionMode = mode;
            await plugin.saveSettings();
          });
      });
    const args = new Setting(group)
      .setName(t('terminalAgent.agents.extraArgs'))
      .setDesc(t('terminalAgent.agents.extraPlaceholder'))
      .addText((text) => {
        text
          .setPlaceholder(t('terminalAgent.agents.extraPlaceholder'))
          .setValue(entry.extraArgs)
          .onChange(async (value) => {
            plugin.settings.agentSettings.agents[agent.id].extraArgs = value;
            await plugin.saveSettings();
          });
      });

    args.settingEl.addClass('terminal-agent-command-setting');

    if (agent.accountKind !== 'none') {
      new Setting(group)
        .setName(t('terminalAgent.agents.account', { title: agent.title }))
        .setDesc(t('terminalAgent.agents.accountDesc'))
        .addText((text) => {
          text
            .setPlaceholder(t('terminalAgent.agents.accountPlaceholder'))
            .setValue(entry.accountId)
            .onChange(async (value) => {
              plugin.settings.agentSettings.agents[agent.id].accountId = value.trim();
              await plugin.saveSettings();
            });
        });
    }

    if (agent.usage !== 'none') {
      new Setting(group)
        .setName(t('terminalAgent.agents.usage', { title: agent.title }))
        .setDesc(t('terminalAgent.agents.usageDesc'))
        .addToggle((toggle) => {
          toggle
            .setValue(entry.showUsage)
            .onChange(async (value) => {
              plugin.settings.agentSettings.agents[agent.id].showUsage = value;
              await plugin.saveSettings();
              refreshRegisteredUsage(plugin);
            });
        });
    }
  }

  new Setting(containerEl)
    .setName(t('terminalAgent.agents.status'))
    .setDesc(t('terminalAgent.agents.statusDesc'))
    .addToggle((toggle) => {
      toggle
        .setValue(plugin.settings.agentSettings.showUsageInStatusBar)
        .onChange(async (value) => {
          plugin.settings.agentSettings.showUsageInStatusBar = value;
          await plugin.saveSettings();
          refreshRegisteredUsage(plugin);
        });
    });

  new Setting(containerEl)
    .setName(t('terminalAgent.agents.check'))
    .setDesc(t('terminalAgent.agents.checkDesc'))
    .addButton((button) => {
      button.setButtonText(t('terminalAgent.agents.checkButton')).onClick(() => {
        void openUsage(plugin);
      });
    });
}

export function isAgentId(value: string): value is AgentId {
  return AGENT_CATALOG.some((agent) => agent.id === value);
}
