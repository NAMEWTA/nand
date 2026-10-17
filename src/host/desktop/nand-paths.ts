import path from 'node:path';
import { lstat, realpath } from 'node:fs/promises';
import { validateNandPath } from '../../shared/storage/nand-paths';
import { reissueIfStalled } from '../../shared/storage/stall-guard';

const realpathOf = (absolute: string) => reissueIfStalled('realpath', () => realpath(absolute));
const lstatOf = (absolute: string) => reissueIfStalled('lstat', () => lstat(absolute));

/** Read-only discovery permits ordinary OS filenames and skips linked subtrees. */
export async function discoverableVaultEntry(vaultRoot: string, relative: string): Promise<boolean> {
	const root = await realpathOf(vaultRoot), target = path.resolve(root, relative);
	const tail = path.relative(root, target);
	if (tail === '..' || tail.startsWith('..' + path.sep) || path.isAbsolute(tail)) return false;
	let current = root;
	for (const part of tail.split(path.sep).filter(Boolean)) {
		current = path.join(current, part);
		try { if ((await lstatOf(current)).isSymbolicLink()) return false; }
		catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false; throw error; }
	}
	return true;
}

/** Resolve aliases of the vault itself, then forbid links inside NAND's owned tree. */
export async function absoluteNandPath(vaultRoot: string, relative: string): Promise<string> {
	const owned = validateNandPath(relative);
	return absoluteVaultPath(vaultRoot, owned);
}

/** Legacy content must also stay inside the opened vault while being migrated. */
export async function absoluteVaultPath(vaultRoot: string, relative: string): Promise<string> {
	const owned = validateNandPath('.nand/' + relative).slice(6);
	let current = await realpathOf(vaultRoot);
	for (const part of owned.split('/')) {
		current = path.join(current, part);
		try {
			const stat = await lstatOf(current);
			if (stat.isSymbolicLink()) throw new Error('private-storage.symlink');
		} catch (error) {
			if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
		}
	}
	return current;
}
