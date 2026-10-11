import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GitHost } from '../../core/ports';
import { createGitRunner, machineName } from './git-runner';
import { locateGit, locateRepo } from './locate';
import { cloneRepository } from './clone';

/** Git sync on a desktop: the system git, run in the vault folder. */
export function desktopGitHost(vaultRoot: string): GitHost {
	return {
		locate: locateGit,
		place: (binary, subPath) => locateRepo(binary, vaultRoot, subPath),
		runner: createGitRunner,
		clone: (binary, target, source, options) => cloneRepository(binary, vaultRoot, target, source, options),
		hostname: machineName,
		async readJson(file) {
			try {
				return JSON.parse(await readFile(file, 'utf8')) as unknown;
			} catch {
				return undefined;
			}
		},
		async writeJson(file, value) {
			const parent = path.dirname(file);
			await mkdir(parent, { recursive: true, mode: 0o700 });
			if (process.platform !== 'win32') await chmod(parent, 0o700).catch(() => undefined);
			const temporary = `${file}.${process.pid}.tmp`;
			await writeFile(temporary, `${JSON.stringify(value, null, '\t')}\n`, { encoding: 'utf8', mode: 0o600 });
			await rename(temporary, file);
			if (process.platform !== 'win32') await chmod(file, 0o600).catch(() => undefined);
		},
		resolve: (cwd, relative) => path.resolve(cwd, relative),
	};
}
