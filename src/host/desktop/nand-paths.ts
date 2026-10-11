import path from 'node:path';
import { lstat, realpath } from 'node:fs/promises';
import { validateNandPath } from '../../shared/storage/nand-paths';

/** Resolve aliases of the vault itself, then forbid links inside NAND's owned tree. */
export async function absoluteNandPath(vaultRoot: string, relative: string): Promise<string> {
	const owned = validateNandPath(relative);
	return absoluteVaultPath(vaultRoot, owned);
}

/** Legacy content must also stay inside the opened vault while being migrated. */
export async function absoluteVaultPath(vaultRoot: string, relative: string): Promise<string> {
	const owned = validateNandPath('.nand/' + relative).slice(6);
	let current = await realpath(vaultRoot);
	for (const part of owned.split('/')) {
		current = path.join(current, part);
		try {
			const stat = await lstat(current);
			if (stat.isSymbolicLink()) throw new Error('private-storage.symlink');
		} catch (error) {
			if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
		}
	}
	return current;
}
