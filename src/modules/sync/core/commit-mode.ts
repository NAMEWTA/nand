/**
 * Commit modes, as in obsidian-git (src/main.ts `resolveCommitMode`, MIT, Vinzent03 and Denis Olehov):
 * - `smart` commits what is staged; with nothing staged it stages everything when `autoStageOnEmptyIndex` is on.
 * - `staged` commits only what is staged.
 * - `all` stages every change in the vault first.
 */
export type CommitMode = 'smart' | 'staged' | 'all';
export type ResolvedCommit = 'staged' | 'all' | 'nothing';

export function resolveCommitMode(mode: CommitMode, hasStaged: boolean, autoStageOnEmptyIndex: boolean): ResolvedCommit {
	if (mode === 'all') return 'all';
	if (hasStaged) return 'staged';
	if (mode === 'staged') return 'nothing';
	return autoStageOnEmptyIndex ? 'all' : 'nothing';
}

export interface MessageValues {
	/** Already formatted with the configured date format. */
	date: string;
	hostname: string;
	files: readonly string[];
}

/**
 * Fill a commit message template. Placeholders: `{{date}}`, `{{hostname}}`, `{{numFiles}}` and `{{files}}`
 * (comma separated). With `listFiles`, the changed files follow as the message body.
 */
export function formatCommitMessage(template: string, values: MessageValues, listFiles = false): string {
	let message = template
		.replace(/\{\{date\}\}/g, values.date)
		.replace(/\{\{hostname\}\}/g, values.hostname)
		.replace(/\{\{numFiles\}\}/g, String(values.files.length))
		.replace(/\{\{files\}\}/g, values.files.join(', '))
		.trim();
	if (listFiles && values.files.length) message = `${message}\n\n${values.files.join('\n')}`;
	return message;
}
