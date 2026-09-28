import { Setting, type App } from 'obsidian';
import { AGENT_CATALOG } from '../../../core/agent-launch/catalog';
import type { TerminalSettings } from '../../../core/pty/settings';
import { t } from '../../../shared/i18n/index';
import { openUsage } from '../../agent-usage/open-usage';

export interface AgentSettingsHost {
	app: App;
	manifest: { dir?: string };
	settings: TerminalSettings;
	saveSettings(): Promise<void>;
	refreshUsage(): void;
}

export function renderAgentSettings(containerEl: HTMLElement, plugin: AgentSettingsHost): void {
	containerEl.addClass('terminal-agent-settings');
	new Setting(containerEl)
		.setName(t('terminalAgent.agents.heading'))
		.setDesc(t('terminalAgent.agents.intro'))
		.setHeading();

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
		new Setting(group).setName(agent.title).setHeading();
		group.createEl('a', {
			cls: 'terminal-agent-docs',
			text: t('terminalAgent.agents.documentation'),
			href: agent.installDocsUrl,
		});
		const cli = new Setting(group)
			.setName(t('terminalAgent.agents.cliPath'))
			.setDesc(t('terminalAgent.agents.cliPlaceholder'))
			.addText((text) => {
				text.setPlaceholder(t('terminalAgent.agents.cliPlaceholder'))
					.setValue(entry.cliPath)
					.onChange(async (value) => {
						plugin.settings.agentSettings.agents[agent.id].cliPath = value.trim();
						await plugin.saveSettings();
					});
			});
		cli.settingEl.addClass('terminal-agent-command-setting');
		new Setting(group).setName(t('terminalAgent.agents.agentPermission')).addDropdown((dropdown) => {
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
				text.setPlaceholder(t('terminalAgent.agents.extraPlaceholder'))
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
					text.setPlaceholder(t('terminalAgent.agents.accountPlaceholder'))
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
					toggle.setValue(entry.showUsage).onChange(async (value) => {
						plugin.settings.agentSettings.agents[agent.id].showUsage = value;
						await plugin.saveSettings();
						plugin.refreshUsage();
					});
				});
		}
	}

	new Setting(containerEl)
		.setName(t('terminalAgent.agents.status'))
		.setDesc(t('terminalAgent.agents.statusDesc'))
		.addToggle((toggle) => {
			toggle.setValue(plugin.settings.agentSettings.showUsageInStatusBar).onChange(async (value) => {
				plugin.settings.agentSettings.showUsageInStatusBar = value;
				await plugin.saveSettings();
				plugin.refreshUsage();
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
