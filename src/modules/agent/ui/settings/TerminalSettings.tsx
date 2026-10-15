// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/SettingsFormControls.tsx, TerminalPane.tsx
import { useState } from 'react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/components/select';
import { SettingsSection } from '../../../../ui/components/nand/SettingsSection';
import { SettingsRow, SettingsSwitchRow } from '../../../../ui/components/nand/SettingsFormControls';
import { useT } from '../../../../ui/react/hooks';
import { SHELL_CHOICES, type TerminalSettings as Settings } from '../../core/terminal/settings';
import type { AgentController } from '../../services/controller';
import { useAgentSettings } from './settings-context';
export function TerminalSettings({ controller }: { controller: AgentController }) {
	const t = useT(),
		settings = useAgentSettings(controller.settings),
		[checking, setChecking] = useState(false),
		[helper, setHelper] = useState('');
	const save = <K extends keyof Settings>(key: K, value: Settings[K]) => {
		void controller.settings
			.update((d) => {
				d[key] = value;
			})
			.catch((e) => controller.workspace.report(e));
	};
	const choice = <K extends 'shell' | 'cursorStyle' | 'renderer'>(
		key: K,
		values: readonly Settings[K][],
		labels?: Record<string, string>,
	) => (
		<SettingsRow
			label={t(`agent.settings.${key === 'cursorStyle' ? 'cursor' : key}`)}
			control={
				<Select value={settings[key]} onValueChange={(v) => save(key, v as Settings[K])}>
					<SelectTrigger className="w-48">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{values.map((v) => (
							<SelectItem key={v} value={v}>
								{labels?.[v] ?? v}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			}
		/>
	);
	return (
		<div className="space-y-8">
			<SettingsSection title={t('agent.settings.shellHeading')}>
				{choice('shell', SHELL_CHOICES, {
					default: t('agent.settings.shellDefault'),
					custom: t('agent.settings.shellCustom'),
				})}
				{settings.shell === 'custom' && (
					<SettingsRow
						label={t('agent.settings.customShell')}
						control={
							<Input
								defaultValue={settings.customShellPath}
								onBlur={(e) => save('customShellPath', e.target.value)}
							/>
						}
					/>
				)}
				<SettingsRow
					label={t('agent.settings.shellArgs')}
					control={
						<Input defaultValue={settings.shellArgs} onBlur={(e) => save('shellArgs', e.target.value)} />
					}
				/>
				<SettingsSwitchRow
					label={t('agent.settings.startInVault')}
					checked={settings.startInVault}
					onChange={() => save('startInVault', !settings.startInVault)}
				/>
			</SettingsSection>
			<SettingsSection title={t('agent.settings.appearanceHeading')}>
				<SettingsRow
					label={t('agent.settings.fontFamily')}
					control={
						<Input defaultValue={settings.fontFamily} onBlur={(e) => save('fontFamily', e.target.value)} />
					}
				/>
				{(['fontSize', 'lineHeight', 'scrollback'] as const).map((key) => (
					<SettingsRow
						key={key}
						label={t(`agent.settings.${key}`)}
						control={
							<Input
								type="number"
								min={key === 'fontSize' ? 8 : key === 'lineHeight' ? 1 : 100}
								max={key === 'fontSize' ? 32 : key === 'lineHeight' ? 2 : 10000}
								step={key === 'lineHeight' ? 0.05 : 1}
								defaultValue={settings[key]}
								onBlur={(e) => {
									if (e.target.validity.valid) save(key, Number(e.target.value));
								}}
							/>
						}
					/>
				))}
				{choice('cursorStyle', ['block', 'bar', 'underline'], {
					block: t('agent.settings.cursorBlock'),
					bar: t('agent.settings.cursorBar'),
					underline: t('agent.settings.cursorUnderline'),
				})}
				<SettingsSwitchRow
					label={t('agent.settings.cursorBlink')}
					checked={settings.cursorBlink}
					onChange={() => save('cursorBlink', !settings.cursorBlink)}
				/>
				{choice('renderer', ['webgl', 'dom'], { webgl: 'WebGL', dom: 'DOM' })}
				<SettingsSwitchRow
					label={t('agent.settings.obsidianTheme')}
					checked={settings.useObsidianTheme}
					onChange={() => save('useObsidianTheme', !settings.useObsidianTheme)}
				/>
				{!settings.useObsidianTheme &&
					(['foreground', 'background'] as const).map((key) => (
						<SettingsRow
							key={key}
							label={t(`agent.settings.${key}`)}
							control={
								<Input
									type="color"
									value={settings[key] || (key === 'foreground' ? '#d4d4d4' : '#1e1e1e')}
									onChange={(e) => save(key, e.target.value)}
								/>
							}
						/>
					))}
			</SettingsSection>
			<SettingsRow
				label={t('agent.manage.terminalLinks')}
				control={
					<Button
						variant="outline"
						onClick={() => {
							void controller.configureBrowser().catch((error) => controller.workspace.report(error));
						}}
					>
						{t('agent.manage.browserSettings')}
					</Button>
				}
			/>
			<SettingsSection title={t('agent.settings.helperHeading')} description={t('agent.settings.helperDesc')}>
				<SettingsSwitchRow
					label={t('agent.settings.offline')}
					checked={settings.offline}
					onChange={() => save('offline', !settings.offline)}
				/>
				<SettingsRow
					label={t('agent.settings.helperCheck')}
					description={helper}
					control={
						<Button
							variant="outline"
							disabled={checking}
							onClick={() => {
								setChecking(true);
								void controller
									.checkHelper()
									.then((version) => setHelper(t('agent.helper.ready', { version })))
									.catch((e) => controller.workspace.report(e))
									.finally(() => setChecking(false));
							}}
						>
							{t('agent.settings.helperCheckButton')}
						</Button>
					}
				/>
			</SettingsSection>
		</div>
	);
}
