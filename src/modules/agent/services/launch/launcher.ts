import { Modal, Notice, Platform, type App } from 'obsidian';
import { getAgent } from '../../core/launch/catalog';
import { launchArgs, needsYoloConfirmation } from '../../core/launch/flags';
import type { AgentId, AgentSettings } from '../../core/launch/types';
import type { VaultSession } from '../../core/history/types';
import { accountEnv, restoredAccountReference } from '../../platform/desktop/agents/accounts';
import { accountArgs } from '../../platform/desktop/agents/account-args';
import { deviceId } from '../../../../host/obsidian/storage/device-id';
import { resolveCli } from '../../platform/desktop/agents/resolver';
import { canonicalVaultCwd } from '../../platform/desktop/history/canonical-cwd';
import { checkAccountTranscript } from '../../platform/desktop/agents/transcript';
import { resumeArgs } from '../../platform/desktop/history/scope';
import { t } from '../../../../shared/i18n/index';

/** A session to start: the program, its arguments, directory and environment. */
export interface LaunchRequest {
	file: string;
	args: string[];
	cwd: string;
	env: Record<string, string>;
	title: string;
	agentId?: AgentId;
}

export interface LaunchHost {
	app: App;
	getVaultPath: () => string | undefined;
	getAgentSettings: () => AgentSettings;
	saveAgentSettings: (settings: AgentSettings) => Promise<void>;
	/** Create the session and show it in the workbench. */
	start: (request: LaunchRequest) => Promise<void>;
}

export async function launchAgent(
	host: LaunchHost,
	agentId: AgentId,
	options: { cwd?: string; accountId?: string } = {},
): Promise<void> {
	const settings = host.getAgentSettings();
	const entry = settings.agents[agentId];
	if (!entry?.enabled) {
		new Notice(t('agent.agentOff', { title: getAgent(agentId).title }));
		return;
	}

	if (!await confirmLaunchPermissions(host, agentId)) return;

	const agent = getAgent(agentId);
	const command = resolveCli(agent.detectCommand, entry.cliPath, '');
	if (!command) {
		new Notice(`${t('agent.cliMissing', { title: agent.title })} ${agent.installDocsUrl}`);
		return;
	}

	const cwd = host.getVaultPath();
	if (!cwd) {
		new Notice(t('agent.vaultMissing'));
		return;
	}

	const env = await accountEnv(agent, options.accountId ?? entry.accountId, cwd, deviceId(host.app), true);
	await host.start({
		file: command,
		args: accountArgs(agentId, launchArgs(settings, agentId), env),
		agentId,
		cwd: options.cwd ?? cwd,
		env: { ...entry.env, ...env },
		title: agent.title,
	});
}

export async function resumeAgent(host: LaunchHost, session: VaultSession): Promise<void> {
	if (!Platform.isDesktop) throw new Error(t('agent.sessionMissing'));
	const vault = host.getVaultPath();
	if (!vault) throw new Error(t('agent.vaultMissing'));
	await canonicalVaultCwd(vault, session.cwd);
	const settings = host.getAgentSettings();
	const entry = settings.agents[session.agentId];
	const agent = getAgent(session.agentId);
	const { env, transcriptPath } = await restoredAccountReference(
		agent,
		session.env,
		vault,
		deviceId(host.app),
		session.transcriptPath,
	);
	await checkAccountTranscript(vault, env, transcriptPath);
	if (!entry?.enabled) {
		new Notice(t('agent.agentOff', { title: agent.title }));
		return;
	}

	if (!await confirmLaunchPermissions(host, session.agentId)) return;

	const command = resolveCli(agent.detectCommand, entry.cliPath, '');
	if (!command) {
		new Notice(t('agent.cliMissing', { title: agent.title }));
		return;
	}

	await host.start({
		file: command,
		agentId: session.agentId,
		args: resumeArgs(
			session.agentId,
			session.agentId === 'pi' ? transcriptPath || '' : session.sessionId,
			accountArgs(session.agentId, launchArgs(settings, session.agentId), env),
		),
		cwd: session.cwd,
		env: { ...entry.env, ...env },
		title: session.title || agent.title,
	});
}

export async function confirmLaunchPermissions(host: LaunchHost, agentId: AgentId): Promise<boolean> {
	const settings = host.getAgentSettings();
	if (!needsYoloConfirmation(settings, agentId)) return true;
	if (!await confirmYolo(host.app)) return false;
	settings.yoloAcknowledgedAgents = [...(settings.yoloAcknowledgedAgents ?? []), agentId];
	await host.saveAgentSettings(settings);
	return true;
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
		contentEl.createEl('h2', { text: t('agent.yoloTitle') });
		contentEl.createEl('p', {
			text: t('agent.yoloDescription'),
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
