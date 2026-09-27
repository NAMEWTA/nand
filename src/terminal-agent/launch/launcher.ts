import { Platform, Modal, Notice, type App } from 'obsidian';
import { t } from '../i18n';
import { resumeArgs } from '../sessions/scope';
import { canonicalVaultCwd } from '../sessions/canonical-cwd';
import type { VaultSession } from '../sessions/types';
import { accountEnv } from './accounts';
import { getAgent } from './catalog';
import { launchArgs } from './flags';
import { resolveCli } from './resolver';
import { probeCommandVersion } from '../terminal/command-version-probe';
import type { AgentId, AgentSettings } from './types';
import type { PendingTerminalSession } from './types';

export interface LaunchHost {
  app: App;
  getVaultPath: () => string | undefined;
  getPluginDataDir: () => string;
  getAgentSettings: () => AgentSettings;
  saveAgentSettings: (settings: AgentSettings) => Promise<void>;
  queueSession: (session: PendingTerminalSession) => void | Promise<void>;
  openFreshTerminal: () => Promise<void>;
  noteLocalVersion?: (agentId: AgentId, version: string | null) => void;
}

export async function launchAgent(host: LaunchHost, agentId: AgentId): Promise<void> {
  const settings = host.getAgentSettings();
  const entry = settings.agents[agentId];
  if (!entry?.enabled) {
    new Notice(t('sessions.disabled', { title: getAgent(agentId).title }));
    return;
  }

  if (needsYoloConfirm(settings, agentId)) {
    const accepted = await confirmYolo(host.app);
    if (!accepted) return;
    settings.yoloAcknowledged = true;
    await host.saveAgentSettings(settings);
  }

  const agent = getAgent(agentId);
  const command = resolveCli(agent.detectCommand, entry.cliPath, '');
  if (!command) {
    new Notice(`${t('sessions.missingCli', { title: agent.title })} ${agent.installDocsUrl}`);
    return;
  }

  const cwd = host.getVaultPath();
  if (!cwd) {
    new Notice(t('workbench.vaultMissing'));
    return;
  }

  const probed = await probeCommandVersion(command).catch(() => null);
  host.noteLocalVersion?.(agentId, probed?.version ?? null);

  await host.queueSession({
    shellType: `custom:${command}`,
    shellArgs: launchArgs(settings, agentId),
    agentId,
    cwd,
    env: {
      ...accountEnv(agent, entry.accountId, host.getPluginDataDir()),
      TERM: 'xterm-256color',
    },
    title: agent.title,
  });
  await host.openFreshTerminal();
}

export async function resumeAgent(host: LaunchHost, session: VaultSession): Promise<void> {
  if (!Platform.isDesktop) throw new Error(t('workbench.sessionMissing'));
  const vault = host.getVaultPath();
  if (!vault) throw new Error(t('sessions.missingCli', { title: session.agentId }));
  await canonicalVaultCwd(vault, session.cwd);
  if (session.transcriptPath && !(await (window.require('node:fs/promises') as typeof import('node:fs/promises')).stat(session.transcriptPath)).isFile()) throw new Error(t('workbench.sessionMissing'));
  const settings = host.getAgentSettings();
  const entry = settings.agents[session.agentId];
  const agent = getAgent(session.agentId);
  if (!entry?.enabled) {
    new Notice(t('sessions.disabled', { title: agent.title }));
    return;
  }

  if (needsYoloConfirm(settings, session.agentId)) {
    const accepted = await confirmYolo(host.app);
    if (!accepted) return;
    settings.yoloAcknowledged = true;
    await host.saveAgentSettings(settings);
  }

  const command = resolveCli(agent.detectCommand, entry.cliPath, '');
  if (!command) {
    new Notice(t('sessions.missingCli', { title: agent.title }));
    return;
  }

  await host.queueSession({
    shellType: `custom:${command}`,
    agentId: session.agentId,
    shellArgs: resumeArgs(session.agentId, session.agentId === 'pi' ? session.transcriptPath || '' : session.sessionId, launchArgs(settings, session.agentId)),
    cwd: session.cwd,
    env: {
      ...accountEnv(agent, entry.accountId, host.getPluginDataDir()),
      ...session.env,
      TERM: 'xterm-256color',
    },
    title: session.title || agent.title,
  });
  await host.openFreshTerminal();
}

export async function launchShell(host: LaunchHost, shellType: string, title: string): Promise<void> {
  const cwd = host.getVaultPath();
  await host.queueSession({
    shellType,
    cwd,
    title,
    env: { TERM: 'xterm-256color' },
  });
  await host.openFreshTerminal();
}

function needsYoloConfirm(settings: AgentSettings, agentId: AgentId): boolean {
  if (settings.yoloAcknowledged) return false;
  const mode = settings.agents[agentId]?.permissionMode ?? 'inherit';
  const effective = mode === 'inherit' ? settings.globalPermissionMode : mode;
  return effective === 'yolo' && launchArgs(settings, agentId).length > 0;
}

function confirmYolo(app: App): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new YoloConfirmModal(app, resolve);
    modal.open();
  });
}

class YoloConfirmModal extends Modal {
  private settled = false;

  constructor(app: App, private readonly choose: (accepted: boolean) => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: t('workbench.yoloTitle') });
    contentEl.createEl('p', {
      text: t('workbench.yoloDescription'),
    });
    const row = contentEl.createDiv({ cls: 'modal-button-container' });
    const cancel = row.createEl('button', { text: t('common.cancel') });
    const ok = row.createEl('button', { text: t('common.confirm'), cls: 'mod-warning' });
    cancel.addEventListener('click', () => this.finish(false));
    ok.addEventListener('click', () => this.finish(true));
  }

  onClose(): void {
    this.finish(false, true);
  }

  private finish(accepted: boolean, fromClose = false): void {
    if (this.settled) return;
    this.settled = true;
    this.choose(accepted);
    if (!fromClose) this.close();
  }
}
