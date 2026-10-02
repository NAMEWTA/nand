import { bindLocalizedOptions } from '../../primitives/localized-dom';
import { bindLocalizedControl, bindLocalizedElement } from '../../primitives/localized-dom';
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
	bindLocalizedControl(bindLocalizedControl(new Setting(containerEl)
		.setName(t('terminalAgent.agents.heading')), "name", 'terminalAgent.agents.heading')
		.setDesc(t('terminalAgent.agents.intro')), "desc", 'terminalAgent.agents.intro')
		.setHeading();

	bindLocalizedControl(bindLocalizedControl(new Setting(containerEl)
		.setName(t('terminalAgent.agents.permission')), "name", 'terminalAgent.agents.permission')
		.setDesc(t('terminalAgent.agents.permissionDesc')), "desc", 'terminalAgent.agents.permissionDesc')
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
		bindLocalizedElement(group.createEl('a', {
			cls: 'terminal-agent-docs',
			text: t('terminalAgent.agents.documentation'),
			href: agent.installDocsUrl,
		}), 'terminalAgent.agents.documentation');
		const cli = bindLocalizedControl(bindLocalizedControl(new Setting(group)
			.setName(t('terminalAgent.agents.cliPath')), "name", 'terminalAgent.agents.cliPath')
			.setDesc(t('terminalAgent.agents.cliPlaceholder')), "desc", 'terminalAgent.agents.cliPlaceholder')
			.addText((text) => {
				bindLocalizedControl(text.setPlaceholder(t('terminalAgent.agents.cliPlaceholder')), "placeholder", 'terminalAgent.agents.cliPlaceholder')
					.setValue(entry.cliPath)
					.onChange(async (value) => {
						plugin.settings.agentSettings.agents[agent.id].cliPath = value.trim();
						await plugin.saveSettings();
					});
			});
		cli.settingEl.addClass('terminal-agent-command-setting');
		bindLocalizedControl(new Setting(group).setName(t('terminalAgent.agents.agentPermission')), "name", 'terminalAgent.agents.agentPermission').addDropdown((dropdown) => {
			bindLocalizedOptions(dropdown
				.addOption('inherit', t('terminalAgent.agents.followGlobal')), {['inherit']: ['terminalAgent.agents.followGlobal']})
				.addOption('yolo', 'YOLO')
				.addOption('manual', 'Manual')
				.setValue(entry.permissionMode)
				.onChange(async (value) => {
					const mode = value === 'yolo' || value === 'manual' ? value : 'inherit';
					plugin.settings.agentSettings.agents[agent.id].permissionMode = mode;
					await plugin.saveSettings();
				});
		});
		const args = bindLocalizedControl(bindLocalizedControl(new Setting(group)
			.setName(t('terminalAgent.agents.extraArgs')), "name", 'terminalAgent.agents.extraArgs')
			.setDesc(t('terminalAgent.agents.extraPlaceholder')), "desc", 'terminalAgent.agents.extraPlaceholder')
			.addText((text) => {
				bindLocalizedControl(text.setPlaceholder(t('terminalAgent.agents.extraPlaceholder')), "placeholder", 'terminalAgent.agents.extraPlaceholder')
					.setValue(entry.extraArgs)
					.onChange(async (value) => {
						plugin.settings.agentSettings.agents[agent.id].extraArgs = value;
						await plugin.saveSettings();
					});
			});

		args.settingEl.addClass('terminal-agent-command-setting');

		if (agent.accountKind !== 'none') {
			bindLocalizedControl(bindLocalizedControl(new Setting(group)
				.setName(t('terminalAgent.agents.account', { title: agent.title })), "name", 'terminalAgent.agents.account', { title: agent.title })
				.setDesc(t('terminalAgent.agents.accountDesc')), "desc", 'terminalAgent.agents.accountDesc')
				.addText((text) => {
					bindLocalizedControl(text.setPlaceholder(t('terminalAgent.agents.accountPlaceholder')), "placeholder", 'terminalAgent.agents.accountPlaceholder')
						.setValue(entry.accountId)
						.onChange(async (value) => {
							plugin.settings.agentSettings.agents[agent.id].accountId = value.trim();
							await plugin.saveSettings();
						});
				});
		}

		if (agent.usage !== 'none') {
			bindLocalizedControl(bindLocalizedControl(new Setting(group)
				.setName(t('terminalAgent.agents.usage', { title: agent.title })), "name", 'terminalAgent.agents.usage', { title: agent.title })
				.setDesc(t('terminalAgent.agents.usageDesc')), "desc", 'terminalAgent.agents.usageDesc')
				.addToggle((toggle) => {
					toggle.setValue(entry.showUsage).onChange(async (value) => {
						plugin.settings.agentSettings.agents[agent.id].showUsage = value;
						await plugin.saveSettings();
						plugin.refreshUsage();
					});
				});
		}
	}

	bindLocalizedControl(bindLocalizedControl(new Setting(containerEl)
		.setName(t('terminalAgent.agents.status')), "name", 'terminalAgent.agents.status')
		.setDesc(t('terminalAgent.agents.statusDesc')), "desc", 'terminalAgent.agents.statusDesc')
		.addToggle((toggle) => {
			toggle.setValue(plugin.settings.agentSettings.showUsageInStatusBar).onChange(async (value) => {
				plugin.settings.agentSettings.showUsageInStatusBar = value;
				await plugin.saveSettings();
				plugin.refreshUsage();
			});
		});

	bindLocalizedControl(bindLocalizedControl(new Setting(containerEl)
		.setName(t('terminalAgent.agents.check')), "name", 'terminalAgent.agents.check')
		.setDesc(t('terminalAgent.agents.checkDesc')), "desc", 'terminalAgent.agents.checkDesc')
		.addButton((button) => {
			bindLocalizedControl(button.setButtonText(t('terminalAgent.agents.checkButton')), "buttonText", 'terminalAgent.agents.checkButton').onClick(() => {
				void openUsage(plugin);
			});
		});
}
