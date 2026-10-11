import { execFile } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { RepoPlace } from '../../core/ports';
import { GitError } from '../../core/errors';

/** Where git usually lives when it is not on the PATH Obsidian was started with (macOS apps get a short PATH). */
function candidates(preferred: string): string[] {
	const list = preferred.trim() ? [preferred.trim()] : [];
	list.push('git');
	if (process.platform === 'win32')
		list.push('C:\\Program Files\\Git\\cmd\\git.exe', 'C:\\Program Files (x86)\\Git\\cmd\\git.exe');
	else list.push('/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git', '/opt/local/bin/git');
	return [...new Set(list)];
}

function version(binary: string): Promise<string | null> {
	return new Promise((resolve) => {
		execFile(binary, ['--version'], { timeout: 10_000, windowsHide: true, encoding: 'utf8' }, (error, stdout) => {
			resolve(error ? null : stdout.trim());
		});
	});
}

/** The first git that runs: the configured path, then PATH, then the usual install locations. */
export async function locateGit(preferred: string): Promise<{ binary: string; version: string } | null> {
	for (const binary of candidates(preferred)) {
		const found = await version(binary);
		if (found) return { binary, version: found };
	}
	return null;
}

const posix = (value: string) => value.split(path.sep).join('/');

/** Find the repository that holds the vault (or the vault's `subPath` folder) and how their paths relate. */
export async function locateRepo(binary: string, vaultRoot: string, subPath: string): Promise<RepoPlace> {
	const vault = await realpath(vaultRoot);
	let cwd: string;
	try {
		if (path.isAbsolute(subPath.trim()) || subPath.includes('\0')) throw new GitError('invalid-repo-folder');
		cwd = await realpath(path.resolve(vault, subPath.trim()));
		const relative = path.relative(vault, cwd);
		if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !(await stat(cwd)).isDirectory()) throw new GitError('invalid-repo-folder');
	} catch {
		throw new GitError('invalid-repo-folder');
	}
	const top = await new Promise<string | null>((resolve) => {
		execFile(binary, ['rev-parse', '--show-toplevel'], { cwd, timeout: 15_000, windowsHide: true, encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } }, (error, stdout) => {
			resolve(error ? null : stdout.trim());
		});
	});
	const root = top ? await realpath(top).catch(() => path.resolve(top)) : null;
	const toVault = (repoPath: string): string | null => {
		if (!root) return null;
		const relative = posix(path.relative(vault, path.resolve(root, repoPath)));
		return !relative || relative.startsWith('../') || relative === '..' || path.isAbsolute(relative) ? null : relative;
	};
	const toRepo = (vaultPath: string): string | null => {
		if (!root) return null;
		const relative = posix(path.relative(root, path.resolve(vault, vaultPath)));
		return relative.startsWith('../') || relative === '..' || path.isAbsolute(relative) ? null : relative;
	};
	const relativeScope = toRepo('');
	return { cwd, root, toVault, toRepo, scope: relativeScope || '.' };
}
