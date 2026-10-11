import path from 'node:path';
import type { GitHost } from '../../core/ports';
import { createGitRunner, machineName } from './git-runner';
import { locateGit, locateRepo } from './locate';
import { cloneRepository } from './clone';
import type { TextStorage } from '../../../../shared/storage/ports';
import { nativeVaultStorage } from '../../../../host/desktop/vault-storage';
import { SyncDeviceStore } from './device-state';

/** Git sync on a desktop: the system git, run in the vault folder. */
export function desktopGitHost(vaultRoot: string, device: string, storage: TextStorage = nativeVaultStorage(vaultRoot)): GitHost {
	const state = new SyncDeviceStore(storage, vaultRoot, device);
	return {
		locate: locateGit,
		place: (binary, subPath) => locateRepo(binary, vaultRoot, subPath),
		runner: createGitRunner,
		clone: (binary, target, source, options) => cloneRepository(binary, vaultRoot, target, source, options),
		hostname: machineName,
		loadDevice: (cwd, legacy) => state.load(cwd, legacy),
		saveDevice: (cwd, base, value) => state.save(cwd, base, value),
		resolve: (cwd, relative) => path.resolve(cwd, relative),
	};
}
