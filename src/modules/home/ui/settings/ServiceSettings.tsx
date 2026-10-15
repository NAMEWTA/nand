// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/settings.ts, src/album-settings-modal.ts
import { useEffect, useState } from 'react';
import { Platform, type App } from 'obsidian';
import { useT } from '../../../../ui/react/hooks';
import { SettingsSection } from '../../../../ui/components/nand/SettingsSection';
import { SettingsRow } from '../../../../ui/components/nand/SettingsRow';
import { SettingsSwitchRow } from '../../../../ui/components/nand/SettingsSwitchRow';
import { Input } from '../../../../ui/components/input';
import { Button } from '../../../../ui/components/button';
import { Label } from '../../../../ui/components/label';
import type { AlbumConfig, DashboardSettings } from '../../core/board/types';
import { homeServices } from '../../services/instances';
import { Choice } from '../board/controls';
import { DashboardFolderPicker } from '../dialogs/DashboardFolderPicker';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { WidgetBackgroundEditor } from './WidgetBackgroundEditor';
import { isValidTz } from '../../core/ticktick/ticktick-tz';
type Props = {
	app?: App;
	settings: DashboardSettings;
	update(this: void, change: (s: DashboardSettings) => void): Promise<void>;
};
export function TickTickServiceSettings({ settings, update, onLogin }: Props & { onLogin: () => void }) {
	const t = useT(),
		[error, setError] = useState('');
	const change = (fn: (s: DashboardSettings) => void) => {
		void update(fn).catch((e) => setError(String(e)));
	};
	return (
		<SettingsSection title={t('ticktick.configure')}>
			<SettingsRow
				label={t('settings.ticktickRegion')}
				description={t('settings.ticktickRegionDesc')}
				control={
					<Choice
						compact
						label={t('settings.ticktickRegion')}
						value={settings.ticktickRegion}
						options={['dida365', 'ticktick'].map((value) => ({
							value,
							label: t(
								value === 'dida365' ? 'settings.ticktickRegionDida' : 'settings.ticktickRegionTick',
							),
						}))}
						onChange={(value) =>
							change((s) => {
								s.ticktickRegion = value as typeof s.ticktickRegion;
							})
						}
					/>
				}
			/>
			<SettingsRow
				label={t('settings.ticktickCookie')}
				description={t('settings.ticktickCookieDesc')}
				control={
					<div className="flex gap-2">
						<Button onClick={onLogin}>{t('settings.ticktickGetCookie')}</Button>
						<Button
							variant="outline"
							disabled={!settings.ticktickCookie}
							onClick={() =>
								change((s) => {
									s.ticktickCookie = '';
									s.ticktickCsrf = '';
								})
							}
						>
							{t('settings.ticktickClearCookie')}
						</Button>
					</div>
				}
			/>
			<SettingsRow
				label={t('settings.ticktickCookieStatus')}
				description={t(settings.ticktickCookie ? 'settings.ticktickCookieSet' : 'settings.ticktickCookieEmpty')}
				control={null}
			/>
			<SettingsRow
				label={t('settings.ticktickDeviceVersion')}
				description={t('settings.ticktickDeviceVersionDesc')}
				control={
					<Input
						value={settings.ticktickDeviceVersion}
						onChange={(e) => {
							const value = e.target.value;
							change((s) => {
								s.ticktickDeviceVersion = value;
							});
						}}
					/>
				}
			/>
			<SettingsRow
				label={t('settings.ticktickTimezone')}
				description={t('settings.ticktickTimezoneDesc')}
				control={
					<Input
						key={settings.ticktickTimezone}
						defaultValue={settings.ticktickTimezone}
						onBlur={(e) => {
							const value = e.target.value.trim();
							if (!isValidTz(value)) {
								setError(t('settings.ticktickTimezoneInvalid'));
								return;
							}
							setError('');
							change((s) => {
								s.ticktickTimezone = value;
							});
						}}
					/>
				}
			/>
			{error && (
				<p role="alert" className="text-destructive">
					{error}
				</p>
			)}
		</SettingsSection>
	);
}
export function ReadingServiceSettings({ settings, update }: Props) {
	const t = useT(),
		[error, setError] = useState('');
	return (
		<SettingsSection title={t('settings.wereadApiKey')}>
			{(['wereadApiKey', 'wereadImportPath'] as const).map((key) => (
				<SettingsRow
					key={key}
					label={t(`settings.${key}`)}
					description={t(`settings.${key}Desc`)}
					control={
						<Input
							type={key === 'wereadApiKey' ? 'password' : 'text'}
							value={settings[key]}
							onChange={(event) => {
								const value = event.target.value;
								void update((s) => {
									s[key] =
										key === 'wereadImportPath'
											? value.trim().replace(/^\/+|\/+$/g, '')
											: value.trim();
								}).catch((e) => setError(String(e)));
							}}
						/>
					}
				/>
			))}
			<Button variant="link" asChild>
				<a href="https://weread.qq.com/r/weread-skills" target="_blank" rel="noopener noreferrer">
					{t('settings.wereadGetKey')}
				</a>
			</Button>
			{error && <p role="alert">{error}</p>}
		</SettingsSection>
	);
}
export function MediaServiceSettings({ app, settings, update }: Props) {
	const t = useT(),
		[picking, setPicking] = useState(false),
		[album, setAlbum] = useState<AlbumConfig | null>(null),
		[error, setError] = useState(''),
		[busy, setBusy] = useState(false),
		[, refresh] = useState(0),
		service = homeServices.music;
	useEffect(() => service?.subscribe(() => refresh((n) => n + 1)), [service]);
	const run = (task: Promise<unknown>) => {
		void task.catch((e) => setError(String(e)));
	};
	const account = async (login: boolean) => {
		setBusy(true);
		try {
			if (login) await service?.login();
			else await service?.logout();
		} catch (e) {
			if (!(e instanceof Error && e.message === 'CANCELLED'))
				setError(t(login ? 'music.accountFailed' : 'music.accountLogoutFailed'));
		} finally {
			setBusy(false);
		}
	};
	return (
		<>
			<SettingsSection title={t('settings.widgetMusic')}>
				<SettingsSwitchRow
					label={t('settings.widgetMusic')}
					checked={settings.widgetMusicEnabled}
					onChange={() =>
						run(
							update((s) => {
								s.widgetMusicEnabled = !s.widgetMusicEnabled;
								if (!s.widgetMusicEnabled) service?.pause();
							}),
						)
					}
				/>
				{Platform.isDesktopApp && service && (
					<SettingsRow
						label={t('music.accountTitle')}
						description={t(service.account.loggedIn ? 'music.accountSignedIn' : 'music.accountSignedOut')}
						control={
							<div className="flex gap-2">
								<Button
									disabled={busy}
									onClick={() => {
										void account(true);
									}}
								>
									{t('music.accountLogin')}
								</Button>
								<Button
									disabled={busy}
									variant="outline"
									onClick={() => {
										void account(false);
									}}
								>
									{t('music.accountLogout')}
								</Button>
							</div>
						}
					/>
				)}
				<WidgetBackgroundEditor
					app={app}
					value={settings.musicBackground}
					onChange={(value) =>
						run(
							update((s) => {
								s.musicBackground = value;
							}),
						)
					}
				/>
			</SettingsSection>
			<SettingsSection title={t('settings.widgetAlbum')}>
				{settings.albums.map((config) => (
					<SettingsRow
						key={config.id}
						label={config.folder || t('album.unsetFolder')}
						description={t(`album.size.${config.heightRatio}`)}
						control={
							<div className="flex gap-2">
								<Button variant="outline" onClick={() => setAlbum({ ...config })}>
									{t('common.edit')}
								</Button>
								<Button
									variant="ghost"
									onClick={() =>
										run(
											update((s) => {
												s.albums = s.albums.filter((a) => a.id !== config.id);
											}),
										)
									}
								>
									{t('common.delete')}
								</Button>
							</div>
						}
					/>
				))}
				<Button
					variant="outline"
					onClick={() =>
						setAlbum({
							id: Date.now(),
							folder: '',
							intervalSec: 8,
							recursive: true,
							ratio: '1:1',
							transition: 'fade',
							heightRatio: 'full',
						})
					}
				>
					{t('album.add')}
				</Button>
			</SettingsSection>
			{error && <p role="alert">{error}</p>}
			{album && (
				<DashboardDialog
					title={t('settings.widgetAlbum')}
					onClose={() => setAlbum(null)}
					onSave={() =>
						run(
							update((s) => {
								const index = s.albums.findIndex((a) => a.id === album.id);
								if (index < 0) s.albums.push(album);
								else s.albums[index] = album;
							}).then(() => setAlbum(null)),
						)
					}
				>
					<Label>
						{t('settings.widgetAlbumFolder')}
						<Input
							value={album.folder}
							onChange={(event) => setAlbum({ ...album, folder: event.target.value })}
						/>
					</Label>
					{app && (
						<Button variant="outline" onClick={() => setPicking(true)}>
							{t('pathPicker.pickFolder')}
						</Button>
					)}
					{app && picking && (
						<DashboardFolderPicker
							app={app}
							single
							initial={album.folder ? [album.folder] : []}
							onClose={() => setPicking(false)}
							onSave={(paths) => {
								setAlbum({ ...album, folder: paths[0] ?? '' });
								setPicking(false);
							}}
						/>
					)}
					<Label>
						{t('settings.widgetAlbumInterval')}
						<Input
							type="number"
							min={3}
							max={60}
							value={album.intervalSec}
							onChange={(event) =>
								setAlbum({ ...album, intervalSec: Math.max(3, Math.min(60, +event.target.value)) })
							}
						/>
					</Label>
					<Choice
						label={t('settings.widgetAlbumRatio')}
						value={album.ratio}
						options={[
							{ value: '1:1', label: '1:1' },
							{ value: '3:4', label: '3:4' },
						]}
						onChange={(ratio) => setAlbum({ ...album, ratio: ratio as AlbumConfig['ratio'] })}
					/>
					<SettingsSwitchRow
						label={t('settings.widgetAlbumRecursive')}
						checked={album.recursive}
						onChange={() => setAlbum({ ...album, recursive: !album.recursive })}
					/>
					<Choice
						label={t('settings.widgetAlbumTransition')}
						value={album.transition}
						options={['fade', 'slide-left', 'slide-right', 'zoom'].map((value) => ({
							value,
							label: t(
								`settings.widgetAlbumTransition${value === 'slide-left' ? 'SlideLeft' : value === 'slide-right' ? 'SlideRight' : value === 'zoom' ? 'Zoom' : 'Fade'}`,
							),
						}))}
						onChange={(transition) =>
							setAlbum({ ...album, transition: transition as AlbumConfig['transition'] })
						}
					/>
					<Choice
						label={t('album.heightRatio')}
						value={album.heightRatio}
						options={['full', 'twoThirds', 'half', 'third'].map((value) => ({
							value,
							label: t(`album.size.${value}`),
						}))}
						onChange={(heightRatio) =>
							setAlbum({ ...album, heightRatio: heightRatio as AlbumConfig['heightRatio'] })
						}
					/>
				</DashboardDialog>
			)}
		</>
	);
}
