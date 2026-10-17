// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/Settings.tsx
import { useContext, useCallback, useState, useSyncExternalStore } from 'react';
import { Platform } from 'obsidian';
import type DashboardPlugin from '../../main';
import { t } from '../../../shared/i18n';
import { SettingsSection } from '../../../ui/components/nand/SettingsSection';
import {
	SettingsRow,
	SettingsSwitchRow,
	SettingsBadge,
	SegmentedControl,
} from '../../../ui/components/nand/SettingsFormControls';
import { SettingsSearchContext, SearchableSetting, SearchHighlight } from './SearchableSetting';
import type { AppSettings } from '../app-schema';
import { STATUS_ITEMS, itemShown, withItemShown } from '../../workbench/status-segments';
import { Button } from '../../../ui/components/button';
import type { WorkbenchTarget } from '../../contracts/workbench';
export function GeneralSettings({
	plugin,
	navigate,
}: {
	plugin: DashboardPlugin;
	navigate: (target: WorkbenchTarget) => void;
}) {
	const query = useContext(SettingsSearchContext);
	const sectionClass = query ? 'hidden has-[[data-searchable-setting]]:block' : undefined;
	const settings = useSyncExternalStore(
		useCallback((listener) => plugin.appSettings.subscribe(listener), [plugin]),
		() => plugin.appSettings.get(),
	);
	const [pending, setPending] = useState('');
	const [error, setError] = useState('');
	const run = (key: string, action: () => Promise<unknown>) => {
		setPending(key);
		setError('');
		void action()
			.catch(() => setError(t('settings.writeFailed')))
			.finally(() => setPending(''));
	};
	const save = (key: string, recipe: (draft: AppSettings) => void) =>
		run(key, () => plugin.appSettings.update(recipe));
	const row = (key: string, control: React.ReactNode, description?: string) => (
		<SearchableSetting title={t(key)} description={description} keywords={[key]}>
			<SettingsRow
				label={<SearchHighlight text={t(key)} />}
				description={description}
				control={control}
				className="flex-wrap"
			/>
		</SearchableSetting>
	);
	const toggle = (key: string, checked: boolean, change: () => void, description?: string, label = t(key)) => (
		<SearchableSetting title={label} description={description} keywords={[key]}>
			<SettingsSwitchRow
				label={<SearchHighlight text={label} />}
				ariaLabel={label}
				checked={checked}
				onChange={change}
				disabled={!!pending}
				description={description}
			/>
		</SearchableSetting>
	);
	return (
		<div className="contents">
			{error && (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			)}
			<SettingsSection className={sectionClass} title={t('settings.homeGeneral')}>
				{row(
					'settings.language',
					<SegmentedControl
						value={settings.language}
						ariaLabel={t('settings.language')}
						onChange={(language) => run('language', () => plugin.changeLanguage(language))}
						options={[
							{ value: 'zh', label: t('settings.languageZh') },
							{ value: 'en', label: t('settings.languageEn') },
						]}
					/>,
					t('settings.languageDesc'),
				)}
				{row(
					'shell.font',
					<SegmentedControl
						value={settings.font}
						ariaLabel={t('shell.font')}
						onChange={(font) =>
							save('font', (draft) => {
								draft.font = font;
							})
						}
						options={[
							{ value: 'geist', label: t('ui.geistFont') },
							{ value: 'host', label: t('ui.hostFont') },
						]}
					/>,
				)}
				{row(
					'shell.palette',
					<SegmentedControl
						wrap
						value={settings.palette}
						ariaLabel={t('shell.palette')}
						onChange={(palette) =>
							save('palette', (draft) => {
								draft.palette = palette;
							})
						}
						options={[
							{ value: 'host', label: t('ui.hostPalette') },
							{ value: 'orca', label: t('ui.orcaPalette') },
						]}
					/>,
					t('shell.paletteDesc'),
				)}
				{settings.devGallery &&
					row(
						'settings.componentGallery',
						<Button
							variant="outline"
							size="sm"
							onClick={() => navigate({ feature: 'settings', section: 'components' })}
						>
							{t('ui.open')}
						</Button>,
						t('shell.developmentMode'),
					)}
			</SettingsSection>
			<SettingsSection className={sectionClass} title={t('shell.statusBar')}>
				{STATUS_ITEMS.map((item) =>
					toggle(
						item.labelKey,
						itemShown(settings.statusBar, item.id),
						() =>
							save(`status-${item.id}`, (draft) => {
								draft.statusBar = withItemShown(draft.statusBar, item.id, !itemShown(draft.statusBar, item.id));
							}),
						undefined,
						t('shell.showStatusItem', { item: t(item.labelKey) }),
					),
				)}
				{row(
					'shell.usageDisplay',
					<SegmentedControl
						value={settings.statusBar.usageDisplay}
						ariaLabel={t('shell.usageDisplay')}
						onChange={(value) =>
							save('display', (draft) => {
								draft.statusBar.usageDisplay = value;
							})
						}
						options={[
							{ value: 'used', label: t('shell.used') },
							{ value: 'remaining', label: t('shell.remaining') },
						]}
					/>,
				)}
				{row(
					'shell.usageMode',
					<SegmentedControl
						value={settings.statusBar.usageMode}
						ariaLabel={t('shell.usageMode')}
						onChange={(value) =>
							save('mode', (draft) => {
								draft.statusBar.usageMode = value;
							})
						}
						options={[
							{ value: 'verbose', label: t('shell.verbose') },
							{ value: 'compact', label: t('shell.compact') },
						]}
					/>,
				)}
			</SettingsSection>
			<SettingsSection className={sectionClass} title={t('settings.homeModules')}>
				{plugin.moduleManifests().map((manifest) => (
					<SearchableSetting
						key={manifest.id}
						title={t(manifest.titleKey)}
						description={t(manifest.descriptionKey)}
						keywords={[manifest.id]}
					>
						<SettingsSwitchRow
							label={
								<>
									<SearchHighlight text={t(manifest.titleKey)} />
									{!manifest.platforms.mobile && (
										<SettingsBadge className="ml-2">{t('shell.desktopRequired')}</SettingsBadge>
									)}
								</>
							}
							ariaLabel={t(manifest.titleKey)}
							description={t(manifest.descriptionKey)}
							checked={settings.modules[manifest.id]}
							disabled={!!pending || (Platform.isMobile && !manifest.platforms.mobile)}
							onChange={() =>
								run(manifest.id, () =>
									plugin.setModuleEnabled(manifest.id, !settings.modules[manifest.id]),
								)
							}
						/>
					</SearchableSetting>
				))}
			</SettingsSection>
		</div>
	);
}
