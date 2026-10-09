/**
 * Why a git step failed. The kinds decide what the user is told and whether automatic sync keeps trying;
 * git runs with `LC_ALL=C`, so the messages matched here are git's English ones.
 */
export type GitErrorKind =
	| 'missing-git'
	| 'not-repo'
	| 'timeout'
	| 'cancelled'
	| 'network'
	| 'auth'
	| 'permission'
	| 'remote-missing'
	| 'rejected'
	| 'locked'
	| 'conflict'
	| 'local-changes'
	| 'identity'
	| 'no-remote'
	| 'no-upstream'
	| 'detached'
	| 'empty-message'
	| 'outside-index'
	| 'unknown';

export class GitError extends Error {
	constructor(
		readonly kind: GitErrorKind,
		/** The tail of git's own output, for the details line. Never contains credentials (see `scrub`). */
		readonly detail = '',
	) {
		super(detail ? `${kind}: ${detail}` : kind);
		this.name = 'GitError';
	}
}

const patterns: ReadonlyArray<readonly [GitErrorKind, RegExp]> = [
	['locked', /\.lock': File exists|Unable to create '[^']*\.lock'|another git process seems to be running/i],
	['not-repo', /not a git repository/i],
	['identity', /Please tell me who you are|unable to auto-detect email address|empty ident name/i],
	['auth', /Authentication failed|could not read (Username|Password)|terminal prompts disabled|Permission denied \((publickey|keyboard-interactive|password)|invalid username or password|HTTP Basic: Access denied|returned error: 401|Host key verification failed/i],
	['permission', /returned error: 403|Permission to .* denied|permission denied|insufficient permission|protected branch|pre-receive hook declined/i],
	['remote-missing', /does not appear to be a git repository|Repository not found|repository '[^']*' not found|returned error: 404|No such remote/i],
	['rejected', /\[rejected\]|non-fast-forward|\(fetch first\)|Updates were rejected|failed to push some refs/i],
	['local-changes', /would be overwritten by (merge|checkout)|Please commit your changes or stash them|You have unstaged changes|cannot (pull|rebase) with rebase|untracked working tree files would be/i],
	['conflict', /^CONFLICT|Automatic merge failed|Merge conflict|could not apply|fix conflicts|you need to resolve your current index first|unmerged files|Committing is not possible because you have unmerged/im],
	['no-upstream', /has no upstream branch|no upstream configured|There is no tracking information/i],
	['network', /Could not resolve host|Could not resolve hostname|Connection (timed out|refused|reset)|Network is unreachable|Failed to connect|unable to access|Operation timed out|early EOF|The remote end hung up|RPC failed|Could not read from remote repository|SSL|TLS/i],
];

/** The error kind for a failed git command, from its output. */
export function classifyGitOutput(output: string): GitErrorKind {
	for (const [kind, pattern] of patterns) if (pattern.test(output)) return kind;
	return 'unknown';
}

/** Remove credentials embedded in URLs (`https://user:token@host`) before output reaches the UI or logs. */
export function scrub(text: string): string {
	return text.replace(/(\b[a-z][\w+.-]*:\/\/)[^\s/@]+@/gi, '$1***@');
}

/** The last few meaningful lines of git's output, without hints. */
export function detailOf(stdout: string, stderr: string, max = 400): string {
	const lines = `${stderr}\n${stdout}`
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line && !/^hint:/i.test(line));
	const text = scrub(lines.slice(-4).join('\n'));
	return text.length > max ? `…${text.slice(-max)}` : text;
}

/** Automatic sync stops retrying after these, because the next run would fail the same way until someone acts. */
export function needsAttention(kind: GitErrorKind): boolean {
	return !['network', 'timeout', 'locked', 'cancelled'].includes(kind);
}
