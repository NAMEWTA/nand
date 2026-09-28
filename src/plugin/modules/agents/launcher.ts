import { Modal, Notice, Platform, type App } from 'obsidian';
import { getAgent } from '../../../core/agent-launch/catalog';
import { launchArgs } from '../../../core/agent-launch/flags';
import type { AgentId, AgentSettings, PendingTerminalSession } from '../../../core/agent-launch/types';
import type { VaultSession } from '../../../core/ai-vault/types';
import { accountEnv } from '../../../platform/desktop/agents/accounts';
import { resolveCli } from '../../../platform/desktop/agents/resolver';
import { canonicalVaultCwd } from '../../../platform/desktop/ai-vault/canonical-cwd';
import { resumeArgs } from '../../../platform/desktop/ai-vault/scope';
import { probeCommandVersion } from '../../../platform/desktop/terminal/command-version-probe';
import { t } from '../../../shared/i18n/terminal-accessor';

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
	if (
		session.transcriptPath &&
		!(
			await (window.require('node:fs/promises') as typeof import('node:fs/promises')).stat(session.transcriptPath)
		).isFile()
	)
		throw new Error(t('workbench.sessionMissing'));
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
		shellArgs: resumeArgs(
			session.agentId,
			session.agentId === 'pi' ? session.transcriptPath || '' : session.sessionId,
			launchArgs(settings, session.agentId),
		),
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

	constructor(
		app: App,
		private readonly choose: (accepted: boolean) => void,
	) {
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
