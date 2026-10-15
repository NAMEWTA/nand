// Layout adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/SettingsFormControls.tsx
import { useState } from 'react';
import { Platform } from 'obsidian';
import { toast } from 'sonner';
import type IconicController from '../../platform/host/controller';
import type { Category } from '../../core/types';
import { internalApp } from '../../platform/utils/obsidian-internal';
import { useT } from '../../../../ui/react/hooks';
import { SettingsSection } from '../../../../ui/components/nand/SettingsSection';
import { SettingsRow, SettingsSwitchRow } from '../../../../ui/components/nand/SettingsFormControls';
import { Choice } from '../../../../ui/components/nand/Choice';
import { Button } from '../../../../ui/components/button';
import { Slider } from '../../../../ui/components/slider';
import RulePicker from '../dialogs/rule-picker';
import UsageChecker from '../dialogs/usage-checker';
export const ICONIC_SETTINGS_PAGES = [
	'iconic-general',
	'iconic-sidebars',
	'iconic-editor',
	'iconic-menus',
	'iconic-picker',
	'iconic-advanced',
] as const;
type Settings = IconicController['settings'];
type BooleanKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
export function IconicSettings({ plugin, section }: { plugin: IconicController; section: string }) {
	const t = useT(),
		[, refresh] = useState(0),
		[busy, setBusy] = useState(false);
	const settings = plugin.settings;
	const save = <K extends keyof Settings>(key: K, value: Settings[K], manager?: Category | 'all' | 'body') => {
		refresh((n) => n + 1);
		void plugin.updatePreference(key, value).catch(() => toast.error(t('settings.writeFailed')));
		if (manager === 'body') plugin.refreshBody();
		else if (manager === 'all') plugin.refreshManagers();
		else if (manager) plugin.refreshManagers(manager);
		if (key === 'clickableIcons') plugin.refreshBody();
	};
	const toggle = (key: BooleanKey, manager?: Category | 'all' | 'body') => (
		<SettingsSwitchRow
			key={key}
			label={t(`iconic.settings.${key}.name`)}
			description={t(`iconic.settings.${key}.desc`)}
			checked={settings[key]}
			onChange={() => save(key, !settings[key], manager)}
		/>
	);
	const select = (
		key: 'biggerIcons' | 'clickableIcons' | 'showItemName' | 'useSearchKeywords' | 'colorPicker1' | 'colorPicker2',
		values: string[],
		manager?: Category | 'all' | 'body',
	) => {
		const platform = Platform.isDesktop ? 'Desktop' : 'Mobile';
		const label = t(`iconic.settings.${key}.name${key === 'clickableIcons' ? platform : ''}`);
		return (
			<SettingsRow
				key={key}
				label={label}
				description={t(
					`iconic.settings.${key}.desc${key === 'clickableIcons' || key === 'colorPicker1' || key === 'colorPicker2' ? platform : ''}`,
				)}
				control={
					<Choice
						label={label}
						value={settings[key]}
						options={values.map((v) => [v, t(`iconic.settings.values.${v}`)])}
						onChange={(v) => save(key, v, manager)}
					/>
				}
			/>
		);
	};
	const device = ['on', 'desktop', 'mobile', 'off'];
	return (
		<div className="space-y-8">
			{section === 'iconic-general' && (
				<SettingsSection title={t('modules.iconic')}>
					<SettingsRow
						label={t('iconic.settings.rulebook.name')}
						description={t('iconic.settings.rulebook.desc')}
						control={
							<Button variant="outline" onClick={() => RulePicker.open(plugin)}>
								{t('iconic.settings.manage')}
							</Button>
						}
					/>
					{select('biggerIcons', device, 'body')}
					{select('clickableIcons', device, 'all')}
				</SettingsSection>
			)}
			{section === 'iconic-sidebars' && (
				<SettingsSection title={t('iconic.settings.headingSidebarsAndTabs')}>
					{toggle('showAllFileIcons', 'file')}
					{toggle('showAllFolderIcons', 'folder')}
					{toggle('minimalFolderIcons', 'folder')}
					{toggle('showMarkdownTabIcons', 'body')}
				</SettingsSection>
			)}
			{section === 'iconic-editor' && (
				<SettingsSection title={t('iconic.settings.headingEditor')}>
					{toggle('showTitleIcons', 'file')}
					{toggle('showTagPillIcons', 'tag')}
				</SettingsSection>
			)}
			{section === 'iconic-menus' && (
				<SettingsSection title={t('iconic.settings.headingMenusAndDialogs')}>
					{toggle('showMenuActions', 'all')}
					{toggle('showSuggestionIcons')}
					{toggle('showQuickSwitcherIcons')}
					{toggle('showMoveFileIcons')}
				</SettingsSection>
			)}
			{section === 'iconic-picker' && (
				<SettingsSection title={t('iconic.settings.headingIconPicker')}>
					{select('showItemName', device)}
					{select('useSearchKeywords', device, 'body')}
					<SettingsRow
						label={t('iconic.settings.maxSearchResults.name')}
						description={t('iconic.settings.maxSearchResults.desc')}
						control={
							<div className="flex w-48 items-center gap-3">
								<Slider
									aria-label={t('iconic.settings.maxSearchResults.name')}
									min={50}
									max={500}
									step={10}
									value={[settings.maxSearchResults]}
									onValueChange={(v) => save('maxSearchResults', v[0] ?? 50)}
								/>
								<output className="text-xs tabular-nums">{settings.maxSearchResults}</output>
							</div>
						}
					/>
					{select('colorPicker1', ['list', 'rgb'])}
					{select('colorPicker2', ['list', 'rgb'])}
				</SettingsSection>
			)}
			{section === 'iconic-advanced' && (
				<SettingsSection title={t('iconic.settings.headingAdvanced')}>
					{toggle('uncolorHover', 'body')}
					{toggle('uncolorDrag', 'body')}
					{toggle('uncolorSelect', 'body')}
					{toggle('uncolorQuick', 'ribbon')}
					<SettingsRow
						label={t('iconic.settings.viewUnusedIcons.name')}
						description={t('iconic.settings.viewUnusedIcons.desc')}
						control={
							<Button
								variant="outline"
								disabled={busy}
								onClick={() => {
									setBusy(true);
									void (async () => {
										const unused = [];
										for (const id of Object.keys(settings.fileIcons))
											if (!(await plugin.app.vault.adapter.exists(id)))
												unused.push(plugin.getFileItem(id));
										if (plugin.isActive()) UsageChecker.open(plugin, unused);
									})()
										.catch(() => toast.error(t('settings.writeFailed')))
										.finally(() => setBusy(false));
								}}
							>
								{t('iconic.settings.manage')}
							</Button>
						}
					/>
					<SettingsRow
						label={t('iconic.settings.maxBackups.name')}
						description={t('iconic.settings.maxBackups.desc')}
						control={
							<div className="flex flex-wrap gap-2">
								{Platform.isDesktop && (
									<Button
										variant="outline"
										onClick={() =>
											internalApp(plugin.app).openWithDefaultApp(plugin.manifest.dir ?? '')
										}
									>
										{t('iconic.settings.maxBackups.openPluginFolder')}
									</Button>
								)}
								<Choice
									label={t('iconic.settings.maxBackups.name')}
									value={String(settings.maxBackups)}
									options={Array.from({ length: 10 }, (_, i) => [
										String(i),
										i ? String(i) : t('iconic.settings.values.none'),
									])}
									onChange={(v) => save('maxBackups', Number(v) || 0)}
								/>
							</div>
						}
					/>
				</SettingsSection>
			)}
		</div>
	);
}
