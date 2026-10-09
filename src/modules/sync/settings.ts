import { defineSettings, f } from '../../shared/settings/schema';

const minutes = (fallback = 0) => f.number({ default: fallback, min: 0, max: 7 * 24 * 60, integer: true });

/**
 * Settings namespace `sync`. Commit, pull and push behaviour is shared by every device of the vault; where git
 * lives and which folder holds the repository belong to this device. The automatic-sync clock and pause state are
 * not settings: they are kept per repository and device inside the git directory.
 */
export const syncSettings = defineSettings({
	commitMessage: f.string({ default: 'vault backup: {{date}}', max: 2000 }),
	autoCommitMessage: f.string({ default: 'vault backup: {{date}}', max: 2000 }),
	commitDateFormat: f.string({ default: 'YYYY-MM-DD HH:mm:ss', max: 100 }),
	listChangedFilesInMessageBody: f.boolean({ default: false }),
	syncMethod: f.enum(['merge', 'rebase'] as const, { default: 'merge' }),
	pullBeforePush: f.boolean({ default: true }),
	disablePush: f.boolean({ default: false }),
	autoStageOnEmptyIndex: f.boolean({ default: true }),
	autoCommitOnlyStaged: f.boolean({ default: false }),
	squashCommitsBeforePush: f.boolean({ default: false }),
	/** Minutes between automatic commit-and-sync runs (0: off). */
	autoSaveInterval: minutes(),
	autoPullInterval: minutes(),
	autoPushInterval: minutes(),
	/** Commit on the commit interval and push on its own interval. */
	differentIntervalCommitAndPush: f.boolean({ default: false }),
	/** Run the commit interval after the last edit instead of on a fixed clock. */
	autoBackupAfterFileChange: f.boolean({ default: false }),
	autoPullOnBoot: f.boolean({ default: false }),
	showNoChangesNotice: f.boolean({ default: true }),
	showErrorNotices: f.boolean({ default: true }),
	gitPath: f.string({ default: '', scope: 'device', max: 1000 }),
	/** Folder inside the vault that holds the repository; empty: the vault (or a repository around it). */
	repoSubPath: f.string({ default: '', scope: 'device', max: 1000 }),
});

export type SyncSettings = ReturnType<typeof syncSettings.defaults>;
