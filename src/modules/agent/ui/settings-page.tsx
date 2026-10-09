import { Notice, Setting, type App } from 'obsidian';
import { useState } from 'preact/hooks';
import type { SettingsPageRenderer } from '../../../app/contracts/module';
import { t } from '../../../shared/i18n/index';
import { Button } from '../../../ui/primitives/Button';
import { openDialog } from '../../../ui/primitives/dialog';
import { TextField } from '../../../ui/primitives/TextField';
import { AGENT_CATALOG } from '../core/launch/catalog';
import type { AgentPermissionMode } from '../core/launch/types';
import { SHELL_CHOICES, type LaunchPreset, type ShellChoice, type TerminalSettings } from '../core/terminal/settings';
import type { AgentController } from '../services/controller';

type Save = (recipe: (draft: TerminalSettings) => void) => void;

function editPreset(app: App, preset: LaunchPreset, shells: Record<string, string>, done: (preset: LaunchPreset) => void): void {
	const draft = { ...preset };
	function Form() {
		const [value, setValue] = useState(draft);
		const field = (key: keyof LaunchPreset, label: string, placeholder = '') => (
			<TextField
				label={label}
				value={String(value[key])}
				placeholder={placeholder}
				onInput={(next) => {
					(draft as Record<string, string>)[key] = next;
					setValue({ ...draft });
				}}
			/>
		);
		return (
			<div class="nand-agent-preset-form">
				{field('name', t('agent.settings.presetName'))}
				{field('icon', t('agent.settings.presetIcon'), 'terminal')}
				<label class="nand-agent-preset-shell">
					<span>{t('agent.settings.shell')}</span>
					<select
						class="dropdown"
						value={value.shell}
						onChange={(event) => {
							draft.shell = event.currentTarget.value as ShellChoice;
							setValue({ ...draft });
						}}
					>
						{Object.entries(shells).map(([id, title]) => <option value={id}>{title}</option>)}
					</select>
				</label>
				{field('program', t('agent.settings.presetProgram'), t('agent.settings.presetProgramPlaceholder'))}
				{field('args', t('agent.settings.shellArgs'))}
				{field('cwd', t('agent.settings.presetCwd'), t('agent.settings.presetCwdPlaceholder'))}
				{field('input', t('agent.settings.presetInput'), 'git status')}
			</div>
		);
	}
	openDialog(app, {
		title: preset.name ? t('agent.settings.presetEdit') : t('agent.settings.presetAdd'),
		content: () => <Form />,
		footer: (close) => (
			<>
				<Button onClick={close}>{t('common.cancel')}</Button>
				<Button
					variant="primary"
					onClick={() => {
						if (!draft.name.trim()) {
							new Notice(t('agent.settings.presetNameRequired'));
							return;
						}
						done({ ...draft, name: draft.name.trim() });
						close();
					}}
				>
					{t('common.save')}
				</Button>
			</>
		),
	});
}

function shellSection(container: HTMLElement, controller: AgentController, save: Save, refresh: () => void): Record<string, string> {
	const settings = controller.settings.get();
	new Setting(container).setName(t('agent.settings.shellHeading')).setHeading();
	const shells: Record<string, string> = { default: t('agent.settings.shellDefault') };
	for (const option of controller.shells()) if (option.choice !== 'default') shells[option.choice] = option.title;
	shells.custom = t('agent.settings.shellCustom');
	new Setting(container)
		.setName(t('agent.settings.shell'))
		.addDropdown((dropdown) =>
			dropdown.addOptions(shells).setValue(SHELL_CHOICES.includes(settings.shell) && shells[settings.shell] ? settings.shell : 'default').onChange((value) => {
				save((draft) => { draft.shell = value as ShellChoice; });
				refresh();
			}),
		);
	if (settings.shell === 'custom')
		new Setting(container)
			.setName(t('agent.settings.customShell'))
			.addText((text) => text.setPlaceholder('/usr/local/bin/fish').setValue(settings.customShellPath).onChange((value) => save((draft) => { draft.customShellPath = value.trim(); })));
	new Setting(container)
		.setName(t('agent.settings.shellArgs'))
		.setDesc(t('agent.settings.shellArgsDesc'))
		.addText((text) => text.setPlaceholder('-l').setValue(settings.shellArgs).onChange((value) => save((draft) => { draft.shellArgs = value; })));
	new Setting(container)
		.setName(t('agent.settings.startInVault'))
		.setDesc(t('agent.settings.startInVaultDesc'))
		.addToggle((toggle) => toggle.setValue(settings.startInVault).onChange((value) => save((draft) => { draft.startInVault = value; })));
	return shells;
}

function appearanceSection(container: HTMLElement, controller: AgentController, save: Save, refresh: () => void): void {
	const settings = controller.settings.get();
	new Setting(container).setName(t('agent.settings.appearanceHeading')).setHeading();
	new Setting(container)
		.setName(t('agent.settings.fontFamily'))
		.setDesc(t('agent.settings.fontFamilyDesc'))
		.addText((text) => text.setValue(settings.fontFamily).onChange((value) => save((draft) => { draft.fontFamily = value; })));
	new Setting(container)
		.setName(t('agent.settings.fontSize'))
		.addSlider((slider) => slider.setLimits(8, 32, 1).setValue(settings.fontSize).onChange((value) => save((draft) => { draft.fontSize = value; })));
	new Setting(container)
		.setName(t('agent.settings.lineHeight'))
		.addSlider((slider) => slider.setLimits(1, 2, 0.05).setValue(settings.lineHeight).onChange((value) => save((draft) => { draft.lineHeight = value; })));
	new Setting(container).setName(t('agent.settings.cursor')).addDropdown((dropdown) =>
		dropdown
			.addOptions({ block: t('agent.settings.cursorBlock'), bar: t('agent.settings.cursorBar'), underline: t('agent.settings.cursorUnderline') })
			.setValue(settings.cursorStyle)
			.onChange((value) => save((draft) => { draft.cursorStyle = value as TerminalSettings['cursorStyle']; })),
	);
	new Setting(container).setName(t('agent.settings.cursorBlink')).addToggle((toggle) => toggle.setValue(settings.cursorBlink).onChange((value) => save((draft) => { draft.cursorBlink = value; })));
	new Setting(container)
		.setName(t('agent.settings.scrollback'))
		.setDesc(t('agent.settings.scrollbackDesc'))
		.addText((text) =>
			text.setValue(String(settings.scrollback)).onChange((value) => {
				const lines = Number(value);
				if (Number.isInteger(lines) && lines >= 100 && lines <= 10000) save((draft) => { draft.scrollback = lines; });
			}),
		);
	new Setting(container)
		.setName(t('agent.settings.renderer'))
		.setDesc(t('agent.settings.rendererDesc'))
		.addDropdown((dropdown) => dropdown.addOptions({ webgl: 'WebGL', dom: 'DOM' }).setValue(settings.renderer).onChange((value) => save((draft) => { draft.renderer = value as TerminalSettings['renderer']; })));
	new Setting(container)
		.setName(t('agent.settings.obsidianTheme'))
		.setDesc(t('agent.settings.obsidianThemeDesc'))
		.addToggle((toggle) =>
			toggle.setValue(settings.useObsidianTheme).onChange((value) => {
				save((draft) => { draft.useObsidianTheme = value; });
				refresh();
			}),
		);
	if (!settings.useObsidianTheme) {
		new Setting(container).setName(t('agent.settings.foreground')).addColorPicker((picker) => picker.setValue(settings.foreground || '#d4d4d4').onChange((value) => save((draft) => { draft.foreground = value; })));
		new Setting(container).setName(t('agent.settings.background')).addColorPicker((picker) => picker.setValue(settings.background || '#1e1e1e').onChange((value) => save((draft) => { draft.background = value; })));
	}
}

function presetSection(container: HTMLElement, controller: AgentController, save: Save, refresh: () => void, shells: Record<string, string>): void {
	const presets = controller.settings.get().presets;
	new Setting(container)
		.setName(t('agent.settings.presets'))
		.setDesc(t('agent.settings.presetsDesc'))
		.setHeading()
		.addButton((button) =>
			button.setIcon('plus').setTooltip(t('agent.settings.presetAdd')).onClick(() =>
				editPreset(controller.app, { id: `preset-${crypto.randomUUID().slice(0, 8)}`, name: '', icon: 'terminal', shell: 'default', program: '', args: '', cwd: '', input: '' }, shells, (preset) => {
					save((draft) => { draft.presets = [...draft.presets, preset]; });
					refresh();
				}),
			),
		);
	if (!presets.length) container.createEl('p', { cls: 'setting-item-description', text: t('agent.settings.presetsEmpty') });
	presets.forEach((preset, index) => {
		new Setting(container)
			.setName(preset.name)
			.setDesc([preset.program || shells[preset.shell] || preset.shell, preset.args, preset.input && `↳ ${preset.input}`].filter(Boolean).join(' '))
			.addExtraButton((button) => button.setIcon('play').setTooltip(t('agent.settings.presetRun')).onClick(() => { void controller.newPreset(preset); }))
			.addExtraButton((button) =>
				button.setIcon('arrow-up').setTooltip(t('agent.settings.moveUp')).setDisabled(index === 0).onClick(() => {
					save((draft) => { draft.presets.splice(index - 1, 0, ...draft.presets.splice(index, 1)); });
					refresh();
				}),
			)
			.addExtraButton((button) =>
				button.setIcon('pencil').setTooltip(t('agent.settings.presetEdit')).onClick(() =>
					editPreset(controller.app, preset, shells, (next) => {
						save((draft) => { draft.presets = draft.presets.map((item) => (item.id === next.id ? next : item)); });
						refresh();
					}),
				),
			)
			.addExtraButton((button) =>
				button.setIcon('trash').setTooltip(t('agent.settings.presetDelete')).onClick(() => {
					save((draft) => { draft.presets = draft.presets.filter((item) => item.id !== preset.id); });
					refresh();
				}),
			);
	});
}

function agentSection(container: HTMLElement, controller: AgentController, save: Save, refresh: () => void): void {
	const settings = controller.settings.get().agents;
	new Setting(container).setName(t('agent.settings.agentsHeading')).setDesc(t('agent.settings.agentsIntro')).setHeading();
	new Setting(container)
		.setName(t('agent.settings.permission'))
		.setDesc(t('agent.settings.permissionDesc'))
		.addDropdown((dropdown) => dropdown.addOptions({ yolo: 'YOLO', manual: 'Manual' }).setValue(settings.globalPermissionMode).onChange((value) => save((draft) => { draft.agents.globalPermissionMode = value === 'manual' ? 'manual' : 'yolo'; })));
	new Setting(container)
		.setName(t('agent.settings.usageStatus'))
		.setDesc(t('agent.settings.usageStatusDesc'))
		.addToggle((toggle) => toggle.setValue(settings.showUsageInStatusBar).onChange((value) => save((draft) => { draft.agents.showUsageInStatusBar = value; })));
	for (const agent of AGENT_CATALOG) {
		const entry = settings.agents[agent.id];
		if (!entry) continue;
		const group = container.createDiv({ cls: 'nand-agent-settings-agent' });
		new Setting(group)
			.setName(agent.title)
			.setDesc(agent.installDocsUrl)
			.addToggle((toggle) =>
				toggle.setValue(entry.enabled).onChange((value) => {
					save((draft) => { draft.agents.agents[agent.id].enabled = value; });
					refresh();
				}),
			);
		if (!entry.enabled) continue;
		new Setting(group)
			.setName(t('agent.settings.cliPath'))
			.addText((text) => text.setPlaceholder(t('agent.settings.cliPathPlaceholder')).setValue(entry.cliPath).onChange((value) => save((draft) => { draft.agents.agents[agent.id].cliPath = value.trim(); })));
		new Setting(group).setName(t('agent.settings.agentPermission')).addDropdown((dropdown) =>
			dropdown
				.addOptions({ inherit: t('agent.settings.followGlobal'), yolo: 'YOLO', manual: 'Manual' })
				.setValue(entry.permissionMode)
				.onChange((value) => save((draft) => { draft.agents.agents[agent.id].permissionMode = value as AgentPermissionMode; })),
		);
		new Setting(group)
			.setName(t('agent.settings.extraArgs'))
			.setDesc(t('agent.settings.extraArgsDesc'))
			.addText((text) => text.setValue(entry.extraArgs).onChange((value) => save((draft) => { draft.agents.agents[agent.id].extraArgs = value; })));
		if (agent.accountKind !== 'none')
			new Setting(group)
				.setName(t('agent.settings.account'))
				.setDesc(t('agent.settings.accountDesc'))
				.addText((text) => text.setValue(entry.accountId).onChange((value) => save((draft) => { draft.agents.agents[agent.id].accountId = value.trim(); })));
		if (agent.usage !== 'none')
			new Setting(group).setName(t('agent.settings.showUsage')).addToggle((toggle) => toggle.setValue(entry.showUsage).onChange((value) => save((draft) => { draft.agents.agents[agent.id].showUsage = value; })));
	}
}

function helperSection(container: HTMLElement, controller: AgentController, save: Save): void {
	const settings = controller.settings.get();
	new Setting(container).setName(t('agent.settings.helperHeading')).setDesc(t('agent.settings.helperDesc')).setHeading();
	new Setting(container)
		.setName(t('agent.settings.offline'))
		.setDesc(t('agent.settings.offlineDesc'))
		.addToggle((toggle) => toggle.setValue(settings.offline).onChange((value) => save((draft) => { draft.offline = value; })));
	new Setting(container)
		.setName(t('agent.settings.helperCheck'))
		.setDesc(t('agent.settings.helperCheckDesc'))
		.addButton((button) =>
			button.setButtonText(t('agent.settings.helperCheckButton')).onClick(async () => {
				button.setDisabled(true);
				try {
					const version = await controller.checkHelper();
					new Notice(t('agent.helper.ready', { version }));
				} catch {
					// The failure notice comes from the installer.
				} finally {
					button.setDisabled(false);
				}
			}),
		);
}

/** Settings → Agent: shell, appearance, presets, agents and the native helper. */
export function agentSettingsPage(controller: () => AgentController | undefined): SettingsPageRenderer {
	return (container, page) => {
		const current = controller();
		if (!current) {
			container.createEl('p', { text: t('workbench.notReady') });
			return;
		}
		const save: Save = (recipe) => { void current.settings.update(recipe).catch(() => new Notice(t('settings.writeFailed'))); };
		const refresh = () => page.refresh();
		const shells = shellSection(container, current, save, refresh);
		appearanceSection(container, current, save, refresh);
		presetSection(container, current, save, refresh, shells);
		agentSection(container, current, save, refresh);
		helperSection(container, current, save);
	};
}
