import { debounce, Setting } from 'obsidian';
import type { SettingsPageRenderer } from '../../../app/contracts/module';
import { t } from '../../../shared/i18n/index';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { SyncSettings } from '../settings';
import type { SyncService } from '../services/sync-service';

type BooleanKey = { [K in keyof SyncSettings]: SyncSettings[K] extends boolean ? K : never }[keyof SyncSettings];
type TextKey = 'commitMessage' | 'autoCommitMessage' | 'commitDateFormat' | 'gitPath' | 'repoSubPath';
type MinutesKey = 'autoSaveInterval' | 'autoPullInterval' | 'autoPushInterval';

/**
 * Settings → Git sync. Every row says what it changes in the commit, pull and push flow; where git lives and the
 * repository folder are kept for this device only.
 */
export function syncSettingsPage(settings: SettingsHandle<SyncSettings>, service: () => SyncService | undefined): SettingsPageRenderer {
	return (el, page) => {
		const toggle = (key: BooleanKey, name: string, desc: string) =>
			new Setting(el).setName(t(name)).setDesc(t(desc)).addToggle((control) =>
				control.setValue(settings.get()[key]).onChange((value) => {
					void settings.update((draft) => { draft[key] = value; });
					page.refresh();
				}),
			);
		const text = (key: TextKey, name: string, desc: string, after?: () => void) =>
			new Setting(el).setName(t(name)).setDesc(t(desc)).addText((control) =>
				control.setValue(settings.get()[key]).onChange((value) => {
					void settings.update((draft) => { draft[key] = value; }).then(after);
				}),
			);
		const minutes = (key: MinutesKey, name: string, desc: string) =>
			new Setting(el).setName(t(name)).setDesc(t(desc)).addText((control) => {
				control.inputEl.type = 'number';
				control.inputEl.min = '0';
				control.setValue(String(settings.get()[key])).onChange((value) => {
					const number = Math.max(0, Math.round(Number(value) || 0));
					void settings.update((draft) => { draft[key] = number; });
				});
			});

		const snapshot = service()?.snapshot;
		new Setting(el).setName(t('sync.settings.repository')).setHeading();
		const where = snapshot?.phase === 'ready' ? snapshot.place?.root ?? '' : snapshot?.phase === 'no-git' ? t('sync.noGit') : snapshot?.phase === 'no-repo' ? t('sync.noRepo') : t('sync.starting');
		new Setting(el)
			.setName(t('sync.settings.detected'))
			.setDesc(snapshot?.gitVersion ? `${snapshot.gitVersion} · ${where}` : where)
			.addButton((button) => button.setButtonText(t('sync.settings.detect')).onClick(async () => {
				await service()?.connect();
				page.refresh();
			}));
		const reconnect = debounce(() => void service()?.connect().then(() => page.refresh()), 800, true);
		text('gitPath', 'sync.settings.gitPath', 'sync.settings.gitPathDesc', reconnect);
		text('repoSubPath', 'sync.settings.repoSubPath', 'sync.settings.repoSubPathDesc', reconnect);
		el.createEl('p', { text: t('sync.settings.authHelp'), cls: 'setting-item-description' });

		new Setting(el).setName(t('sync.settings.commit')).setHeading();
		text('commitMessage', 'sync.settings.commitMessage', 'sync.settings.messageDesc');
		text('autoCommitMessage', 'sync.settings.autoCommitMessage', 'sync.settings.messageDesc');
		text('commitDateFormat', 'sync.settings.dateFormat', 'sync.settings.dateFormatDesc');
		toggle('listChangedFilesInMessageBody', 'sync.settings.listFiles', 'sync.settings.listFilesDesc');
		toggle('autoStageOnEmptyIndex', 'sync.settings.autoStage', 'sync.settings.autoStageDesc');

		new Setting(el).setName(t('sync.settings.sync')).setHeading();
		new Setting(el).setName(t('sync.settings.method')).setDesc(t('sync.settings.methodDesc')).addDropdown((control) =>
			control
				.addOption('merge', t('sync.settings.merge'))
				.addOption('rebase', t('sync.settings.rebase'))
				.setValue(settings.get().syncMethod)
				.onChange((value) => void settings.update((draft) => { draft.syncMethod = value === 'rebase' ? 'rebase' : 'merge'; })),
		);
		toggle('pullBeforePush', 'sync.settings.pullBeforePush', 'sync.settings.pullBeforePushDesc');
		toggle('disablePush', 'sync.settings.disablePush', 'sync.settings.disablePushDesc');
		toggle('squashCommitsBeforePush', 'sync.settings.squash', 'sync.settings.squashDesc');

		new Setting(el).setName(t('sync.settings.automatic')).setHeading();
		minutes('autoSaveInterval', 'sync.settings.autoSave', 'sync.settings.autoSaveDesc');
		toggle('autoBackupAfterFileChange', 'sync.settings.afterEdit', 'sync.settings.afterEditDesc');
		toggle('autoCommitOnlyStaged', 'sync.settings.autoOnlyStaged', 'sync.settings.autoOnlyStagedDesc');
		toggle('differentIntervalCommitAndPush', 'sync.settings.separatePush', 'sync.settings.separatePushDesc');
		if (settings.get().differentIntervalCommitAndPush) minutes('autoPushInterval', 'sync.settings.autoPush', 'sync.settings.autoPushDesc');
		minutes('autoPullInterval', 'sync.settings.autoPull', 'sync.settings.autoPullDesc');
		toggle('autoPullOnBoot', 'sync.settings.pullOnStart', 'sync.settings.pullOnStartDesc');
		const paused = service()?.snapshot.device.paused;
		new Setting(el)
			.setName(t('sync.settings.pauseHere'))
			.setDesc(paused === 'failures' ? t('sync.status.pausedFailures') : t('sync.settings.pauseHereDesc'))
			.addToggle((control) =>
				control.setValue(!!paused).onChange(async (value) => {
					await service()?.setPaused(value);
					page.refresh();
				}),
			);

		new Setting(el).setName(t('sync.settings.notices')).setHeading();
		toggle('showNoChangesNotice', 'sync.settings.noChangesNotice', 'sync.settings.noChangesNoticeDesc');
		toggle('showErrorNotices', 'sync.settings.errorNotices', 'sync.settings.errorNoticesDesc');
	};
}
