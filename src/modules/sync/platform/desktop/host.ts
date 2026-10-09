import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GitHost } from '../../core/ports';
import { createGitRunner, machineName } from './git-runner';
import { locateGit, locateRepo } from './locate';

/** Git sync on a desktop: the system git, run in the vault folder. */
export function desktopGitHost(vaultRoot: string): GitHost {
	return {
		locate: locateGit,
		place: (binary, subPath) => locateRepo(binary, vaultRoot, subPath),
		runner: createGitRunner,
		hostname: machineName,
		async readJson(file) {
			try {
				return JSON.parse(await readFile(file, 'utf8')) as unknown;
			} catch {
				return undefined;
			}
		},
		async writeJson(file, value) {
			await mkdir(path.dirname(file), { recursive: true });
			const temporary = `${file}.${process.pid}.tmp`;
			await writeFile(temporary, `${JSON.stringify(value, null, '\t')}\n`, 'utf8');
			await rename(temporary, file);
		},
		resolve: (cwd, relative) => path.resolve(cwd, relative),
	};
}
