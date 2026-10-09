import { Modal, Notice, Platform, type App } from 'obsidian';
import { getAgent } from '../../core/launch/catalog';
import { launchArgs } from '../../core/launch/flags';
import type { AgentId, AgentSettings } from '../../core/launch/types';
import type { VaultSession } from '../../core/history/types';
import { accountEnv } from '../../platform/desktop/agents/accounts';
import { resolveCli } from '../../platform/desktop/agents/resolver';
import { canonicalVaultCwd } from '../../platform/desktop/history/canonical-cwd';
import { isFile } from '../../platform/desktop/history/node-modules';
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
	getPluginDataDir: () => string;
	getAgentSettings: () => AgentSettings;
	saveAgentSettings: (settings: AgentSettings) => Promise<void>;
	/** Create the session and show it in the workbench. */
	start: (request: LaunchRequest) => Promise<void>;
}

export async function launchAgent(host: LaunchHost, agentId: AgentId): Promise<void> {
	const settings = host.getAgentSettings();
	const entry = settings.agents[agentId];
	if (!entry?.enabled) {
		new Notice(t('agent.agentOff', { title: getAgent(agentId).title }));
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
		new Notice(`${t('agent.cliMissing', { title: agent.title })} ${agent.installDocsUrl}`);
		return;
	}

	const cwd = host.getVaultPath();
	if (!cwd) {
		new Notice(t('agent.vaultMissing'));
		return;
	}

	await host.start({
		file: command,
		args: launchArgs(settings, agentId),
		agentId,
		cwd,
		env: accountEnv(agent, entry.accountId, host.getPluginDataDir()),
		title: agent.title,
	});
}

export async function resumeAgent(host: LaunchHost, session: VaultSession): Promise<void> {
	if (!Platform.isDesktop) throw new Error(t('agent.sessionMissing'));
	const vault = host.getVaultPath();
	if (!vault) throw new Error(t('agent.vaultMissing'));
	await canonicalVaultCwd(vault, session.cwd);
	if (session.transcriptPath && !(await isFile(session.transcriptPath)))
		throw new Error(t('agent.sessionMissing'));
	const settings = host.getAgentSettings();
	const entry = settings.agents[session.agentId];
	const agent = getAgent(session.agentId);
	if (!entry?.enabled) {
		new Notice(t('agent.agentOff', { title: agent.title }));
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
		new Notice(t('agent.cliMissing', { title: agent.title }));
		return;
	}

	await host.start({
		file: command,
		agentId: session.agentId,
		args: resumeArgs(
			session.agentId,
			session.agentId === 'pi' ? session.transcriptPath || '' : session.sessionId,
			launchArgs(settings, session.agentId),
		),
		cwd: session.cwd,
		env: {
			...accountEnv(agent, entry.accountId, host.getPluginDataDir()),
			...session.env,
		},
		title: session.title || agent.title,
	});
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
