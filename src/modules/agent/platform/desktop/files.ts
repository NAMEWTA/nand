import { shell, webUtils } from 'electron';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export type ResolvedReference = { kind: 'vault'; path: string } | { kind: 'external'; path: string } | null;

/** Where a file reference printed in a terminal points: a note in the vault, another file, or nothing. */
export function resolveReference(reference: string, cwd: string, vault: string | undefined): ResolvedReference {
	const expanded = reference.startsWith('~/') ? path.join(os.homedir(), reference.slice(2)) : reference;
	const absolute = path.isAbsolute(expanded) ? expanded : path.resolve(cwd, expanded);
	if (vault) {
		const relative = path.relative(vault, absolute);
		if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) return { kind: 'vault', path: relative.split(path.sep).join('/') };
	}
	return fs.existsSync(absolute) ? { kind: 'external', path: absolute } : null;
}

/** Open a file or folder with the system's default application (folders open in the file manager). */
export function openPath(target: string): Promise<string> {
	return shell.openPath(target);
}

/** Absolute path of a file dropped from outside Obsidian, when the system provides one. */
export function droppedFilePath(file: File): string {
	return webUtils?.getPathForFile(file) || (file as File & { path?: string }).path || '';
}

/** Absolute path of a vault file. */
export function vaultFilePath(vault: string, vaultPath: string): string {
	return path.join(vault, ...vaultPath.split('/'));
}
