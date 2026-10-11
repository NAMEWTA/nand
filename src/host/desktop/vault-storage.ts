import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import type { TextStorage } from '../../shared/storage/ports';
import { absoluteNandPath } from './nand-paths';
import { privateTextStorage } from './private-mode';

/** Native tools use the same owned namespace when an Obsidian adapter was not supplied. */
export function nativeVaultStorage(vaultRoot: string): TextStorage {
	const resolve = (relative: string) => absoluteNandPath(vaultRoot, relative);
	return privateTextStorage({
		async exists(relative) {
			try { await lstat(await resolve(relative)); return true; }
			catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false; throw error; }
		},
		async read(relative) { return readFile(await resolve(relative), 'utf8'); },
		async write(relative, text) { await writeFile(await resolve(relative), text, { encoding: 'utf8', mode: 0o600 }); },
		async mkdir(relative) { await mkdir(await resolve(relative), { recursive: true, mode: 0o700 }); },
	}, vaultRoot);
}
