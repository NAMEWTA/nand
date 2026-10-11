import { lstat, mkdtemp, readdir, realpath, rename, rmdir } from 'node:fs/promises';
import path from 'node:path';
import type { CloneOptions, CloneResult } from '../../core/clone';
import { classifyGitOutput, detailOf, GitError, scrub } from '../../core/errors';
import { hasEmbeddedCredentials } from '../../core/remote-url';
import { createGitRunner } from './git-runner';

function validSource(source: string): boolean {
	if (!source || /[\0\r\n]/.test(source) || source.startsWith('-') || hasEmbeddedCredentials(source)) return false;
	if (path.isAbsolute(source)) return true;
	if (!source.includes('://') && /^(?:[\w.-]+@)?[\w.-]+:[^\s]+$/.test(source) && !source.includes('::')) return true;
	try {
		const url = new URL(source);
		return ['https:', 'http:', 'ssh:', 'git:', 'file:'].includes(url.protocol);
	} catch {
		return false;
	}
}

async function emptyTarget(target: string): Promise<boolean> {
	try {
		const entry = await lstat(target);
		if (!entry.isDirectory() || entry.isSymbolicLink()) throw new GitError('invalid-clone-target');
		if ((await readdir(target)).length) throw new GitError('clone-target-not-empty');
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

/** Clone beside the target first: Git's cancellation cleanup never owns the user's directory. */
export async function cloneRepository(binary: string, vaultRoot: string, requestedTarget: string, source: string, options: CloneOptions): Promise<CloneResult> {
	let target = requestedTarget;
	let temporary: string | undefined;
	let started = false;
	const cancelled = () => { if (options.signal.aborted) throw new GitError('cancelled'); };
	try {
		cancelled();
		if (!validSource(source)) throw new GitError('invalid-clone-source');
		if (!path.isAbsolute(target) || target.includes('\0')) throw new GitError('invalid-clone-target');
		const parent = await realpath(path.dirname(path.resolve(target)));
		target = path.join(parent, path.basename(path.resolve(target)));
		const vault = await realpath(vaultRoot);
		const relative = path.relative(vault, target);
		if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) throw new GitError('invalid-clone-target');
		await emptyTarget(target);
		cancelled();
		temporary = await mkdtemp(path.join(parent, '.nand-clone-'));
		const runner = createGitRunner(binary, parent);
		try {
			started = true;
			let pending = '';
			const result = await runner.run(['clone', '--progress', '--', source, temporary], {
				signal: options.signal,
				timeoutMs: 30 * 60_000,
				onProgress(chunk) {
					pending += chunk;
					const lines = pending.split(/[\r\n]/);
					pending = (lines.pop() ?? '').slice(-4096);
					for (const line of lines) {
						const match = /^(Receiving objects|Resolving deltas|Updating files):\s+(\d+)%/.exec(line);
						if (match) options.onProgress?.({ phase: match[1] === 'Receiving objects' ? 'receiving' : match[1] === 'Resolving deltas' ? 'resolving' : 'checkout', percent: Number(match[2]) });
					}
				},
			});
			if (result.code) throw new GitError(classifyGitOutput(`${result.stderr}\n${result.stdout}`), detailOf(result.stdout, result.stderr));
		} finally {
			runner.dispose();
		}
		cancelled();
		// rmdir removes only an empty directory. New user files make this or rename fail; nothing is deleted recursively.
		if (await emptyTarget(target)) await rmdir(target);
		cancelled();
		await rename(temporary, target);
		return { state: 'cloned', target };
	} catch (error) {
		let recoveryPath: string | undefined;
		if (temporary) {
			// Only remove a still-empty directory; retain all partial data for inspection.
			try { await rmdir(temporary); } catch (failure) {
				if ((failure as NodeJS.ErrnoException).code !== 'ENOENT') recoveryPath = temporary;
			}
		}
		const failure = error instanceof GitError ? { kind: error.kind, detail: error.detail } : { kind: classifyGitOutput(String(error)), detail: scrub(error instanceof Error ? error.message : String(error)) };
		return { state: failure.kind === 'cancelled' ? 'cancelled' : started ? 'failed' : 'refused', target, error: failure, recoveryPath };
	}
}
