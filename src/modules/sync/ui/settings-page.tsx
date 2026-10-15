// Layout adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/SettingsFormControls.tsx
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { SyncSettings } from '../settings';
import type { SyncService } from '../services/sync-service';
import { useT, useOwnerWindow } from '../../../ui/react/hooks';
import { SettingsRow, SettingsSwitchRow, NumberField } from '../../../ui/components/nand/SettingsFormControls';
import { SettingsSection } from '../../../ui/components/nand/SettingsSection';
import { Choice } from '../../../ui/components/nand/Choice';
import { Input } from '../../../ui/components/input';
import { Button } from '../../../ui/components/button';

export function syncSettingsPage(settings: SettingsHandle<SyncSettings>, service: () => SyncService | undefined) {
	return function SyncSettingsPage() {
		const t = useT(),
			owner = useOwnerWindow(),
			value = useSyncExternalStore(
				(listener) => settings.subscribe(listener),
				() => settings.get(),
			);
		const current = service();
		const snapshot = useSyncExternalStore(
			(listener) => current?.subscribe(listener) ?? (() => {}),
			() => current?.snapshot,
		);
		const timer = useRef<number | undefined>(undefined);
		useEffect(() => () => owner.clearTimeout(timer.current), [owner]);
		const report = () => toast.error(t('settings.writeFailed'));
		const save = <K extends keyof SyncSettings>(key: K, next: SyncSettings[K]) => {
			void settings
				.update((draft) => {
					draft[key] = next;
				})
				.then(() => {
					if (key === 'gitPath' || key === 'repoSubPath') {
						owner.clearTimeout(timer.current);
						timer.current = owner.setTimeout(() => {
							void current?.connect().catch(report);
						}, 800);
					}
				})
				.catch(report);
		};
		const where =
			snapshot?.phase === 'ready'
				? (snapshot.place?.root ?? '')
				: snapshot?.phase === 'no-git'
					? t('sync.noGit')
					: snapshot?.phase === 'no-repo'
						? t('sync.noRepo')
						: t('sync.starting');
		return (
			<div className="space-y-8">
				<SettingsSection title={t('sync.settings.repository')}>
					<SettingsRow
						label={t('sync.settings.detected')}
						description={snapshot?.gitVersion ? `${snapshot.gitVersion} · ${where}` : where}
						control={
							<Button
								variant="outline"
								onClick={() => {
									void current?.connect().catch(report);
								}}
							>
								{t('sync.settings.detect')}
							</Button>
						}
					/>
					<p className="text-xs text-muted-foreground">{t('sync.settings.authHelp')}</p>
					<SettingsRow
						label={t('sync.settings.gitPath')}
						description={t('sync.settings.gitPathDesc')}
						control={
							<Input
								aria-label={t('sync.settings.gitPath')}
								value={value.gitPath}
								onChange={(e) => save('gitPath', e.target.value)}
							/>
						}
					/>
					<SettingsRow
						label={t('sync.settings.repoSubPath')}
						description={t('sync.settings.repoSubPathDesc')}
						control={
							<Input
								aria-label={t('sync.settings.repoSubPath')}
								value={value.repoSubPath}
								onChange={(e) => save('repoSubPath', e.target.value)}
							/>
						}
					/>
				</SettingsSection>
				<SettingsSection title={t('sync.settings.commit')}>
					<SettingsRow
						label={t('sync.settings.commitMessage')}
						description={t('sync.settings.messageDesc')}
						control={
							<Input
								aria-label={t('sync.settings.commitMessage')}
								value={value.commitMessage}
								onChange={(e) => save('commitMessage', e.target.value)}
							/>
						}
					/>
					<SettingsRow
						label={t('sync.settings.autoCommitMessage')}
						description={t('sync.settings.messageDesc')}
						control={
							<Input
								aria-label={t('sync.settings.autoCommitMessage')}
								value={value.autoCommitMessage}
								onChange={(e) => save('autoCommitMessage', e.target.value)}
							/>
						}
					/>
					<SettingsRow
						label={t('sync.settings.dateFormat')}
						description={t('sync.settings.dateFormatDesc')}
						control={
							<Input
								aria-label={t('sync.settings.dateFormat')}
								value={value.commitDateFormat}
								onChange={(e) => save('commitDateFormat', e.target.value)}
							/>
						}
					/>
					<SettingsSwitchRow
						label={t('sync.settings.listFiles')}
						description={t('sync.settings.listFilesDesc')}
						checked={value.listChangedFilesInMessageBody}
						onChange={() => save('listChangedFilesInMessageBody', !value.listChangedFilesInMessageBody)}
					/>
					<SettingsSwitchRow
						label={t('sync.settings.autoStage')}
						description={t('sync.settings.autoStageDesc')}
						checked={value.autoStageOnEmptyIndex}
						onChange={() => save('autoStageOnEmptyIndex', !value.autoStageOnEmptyIndex)}
					/>
				</SettingsSection>
				<SettingsSection title={t('sync.settings.sync')}>
					<SettingsRow
						label={t('sync.settings.method')}
						description={t('sync.settings.methodDesc')}
						control={
							<Choice
								label={t('sync.settings.method')}
								value={value.syncMethod}
								options={['merge', 'rebase'].map((key) => [key, t(`sync.settings.${key}`)])}
								onChange={(v) => save('syncMethod', v === 'rebase' ? 'rebase' : 'merge')}
							/>
						}
					/>
					<SettingsSwitchRow
						label={t('sync.settings.pullBeforePush')}
						description={t('sync.settings.pullBeforePushDesc')}
						checked={value.pullBeforePush}
						onChange={() => save('pullBeforePush', !value.pullBeforePush)}
					/>
					<SettingsSwitchRow
						label={t('sync.settings.disablePush')}
						description={t('sync.settings.disablePushDesc')}
						checked={value.disablePush}
						onChange={() => save('disablePush', !value.disablePush)}
					/>
					<SettingsSwitchRow
						label={t('sync.settings.squash')}
						description={t('sync.settings.squashDesc')}
						checked={value.squashCommitsBeforePush}
						onChange={() => save('squashCommitsBeforePush', !value.squashCommitsBeforePush)}
					/>
				</SettingsSection>
				<SettingsSection title={t('sync.settings.automatic')}>
					<SettingsSwitchRow
						label={t('sync.settings.pauseHere')}
						description={t(
							snapshot?.device.paused === 'failures'
								? 'sync.status.pausedFailures'
								: 'sync.settings.pauseHereDesc',
						)}
						checked={!!snapshot?.device.paused}
						onChange={() => {
							void current?.setPaused(!snapshot?.device.paused).catch(report);
						}}
					/>
					<NumberField
						label={t('sync.settings.autoSave')}
						description={t('sync.settings.autoSaveDesc')}
						min={0}
						integer
						value={value.autoSaveInterval}
						onChange={(v) => save('autoSaveInterval', v)}
					/>
					<SettingsSwitchRow
						label={t('sync.settings.afterEdit')}
						description={t('sync.settings.afterEditDesc')}
						checked={value.autoBackupAfterFileChange}
						onChange={() => save('autoBackupAfterFileChange', !value.autoBackupAfterFileChange)}
					/>
					<SettingsSwitchRow
						label={t('sync.settings.autoOnlyStaged')}
						description={t('sync.settings.autoOnlyStagedDesc')}
						checked={value.autoCommitOnlyStaged}
						onChange={() => save('autoCommitOnlyStaged', !value.autoCommitOnlyStaged)}
					/>
					<SettingsSwitchRow
						label={t('sync.settings.separatePush')}
						description={t('sync.settings.separatePushDesc')}
						checked={value.differentIntervalCommitAndPush}
						onChange={() => save('differentIntervalCommitAndPush', !value.differentIntervalCommitAndPush)}
					/>
					{value.differentIntervalCommitAndPush && (
						<NumberField
							label={t('sync.settings.autoPush')}
							description={t('sync.settings.autoPushDesc')}
							min={0}
							integer
							value={value.autoPushInterval}
							onChange={(v) => save('autoPushInterval', v)}
						/>
					)}
					<NumberField
						label={t('sync.settings.autoPull')}
						description={t('sync.settings.autoPullDesc')}
						min={0}
						integer
						value={value.autoPullInterval}
						onChange={(v) => save('autoPullInterval', v)}
					/>
					<SettingsSwitchRow
						label={t('sync.settings.pullOnStart')}
						description={t('sync.settings.pullOnStartDesc')}
						checked={value.autoPullOnBoot}
						onChange={() => save('autoPullOnBoot', !value.autoPullOnBoot)}
					/>
				</SettingsSection>
				<SettingsSection title={t('sync.settings.notices')}>
					<SettingsSwitchRow
						label={t('sync.settings.noChangesNotice')}
						description={t('sync.settings.noChangesNoticeDesc')}
						checked={value.showNoChangesNotice}
						onChange={() => save('showNoChangesNotice', !value.showNoChangesNotice)}
					/>
					<SettingsSwitchRow
						label={t('sync.settings.errorNotices')}
						description={t('sync.settings.errorNoticesDesc')}
						checked={value.showErrorNotices}
						onChange={() => save('showErrorNotices', !value.showErrorNotices)}
					/>
				</SettingsSection>
			</div>
		);
	};
}
