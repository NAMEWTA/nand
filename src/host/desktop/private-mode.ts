import path from 'node:path';
import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, opendir, realpath } from 'node:fs/promises';
import type { TextStorage } from '../../shared/storage/ports';

export const PRIVATE_DIR_MODE = 0o700;
export const PRIVATE_FILE_MODE = 0o600;
const MANAGED_DIRECTORIES = ['config', 'browser', 'terminal-agent', 'automation', 'notifications', 'editor', 'icons', 'recovery', 'cache', 'news'];

export function chmodAllowed(platform: string): boolean {
	return ['linux', 'darwin', 'freebsd', 'openbsd', 'aix', 'sunos'].includes(platform);
}

export function isPrivateRelative(vaultPath: string): boolean {
	const normalized = vaultPath.replaceAll('\\', '/').replace(/^(\.\/)+/, '');
	const resolved = path.posix.normalize(normalized);
	return normalized === '.nand' || normalized.startsWith('.nand/') || resolved === '.nand' || resolved.startsWith('.nand/');
}

function code(error: unknown): string {
	return error instanceof Error && 'code' in error ? String(error.code) : 'unknown';
}

async function metadata(absolute: string) {
	try { return await lstat(absolute); }
	catch (error) { if (code(error) === 'ENOENT') return undefined; throw error; }
}

/** Inaccessible paths must not pass as missing. */
export async function privatePathHasSymlink(absolute: string): Promise<boolean> {
	let current = path.parse(absolute).root;
	for (const part of path.relative(current, absolute).split(path.sep).filter(Boolean)) {
		current = path.join(current, part);
		const stat = await metadata(current);
		if (!stat) return false;
		if (stat.isSymbolicLink()) return true;
	}
	return false;
}

export async function tightenPrivateAbsolute(absolute: string, kind: 'dir' | 'file'): Promise<'applied' | 'symlink' | 'skipped' | 'failed'> {
	if (!chmodAllowed(process.platform)) return 'skipped';
	try {
		if (await privatePathHasSymlink(absolute)) return 'symlink';
		await chmod(absolute, kind === 'dir' ? PRIVATE_DIR_MODE : PRIVATE_FILE_MODE);
		return 'applied';
	} catch { return 'failed'; }
}

/** A single port per adapter owns repair and preserves adapter write notifications. */
export function privateTextStorage(inner: TextStorage, vaultRoot: string): TextStorage {
	if (!chmodAllowed(process.platform)) return inner;
	// Resolve aliases outside the vault (e.g. macOS /var); links inside .nand are forbidden.
	const root = realpath(vaultRoot);
	const reported = new Set<string>();
	const report = (relative: string, reason: string) => {
		const category = relative.split('/').slice(0, 2).join('/');
		const key = `${category}:${reason}`;
		if (reported.has(key)) return;
		reported.add(key);
		console.warn('[NAND private storage]', category, reason);
	};
	const privatePath = async (relative: string): Promise<string> => {
		const parts = relative.replaceAll('\\', '/').split('/').filter(part => part && part !== '.');
		if (parts[0] !== '.nand' || parts.includes('..')) throw new Error('private-storage.path');
		return path.join(await root, ...parts);
	};
	const check = async (relative: string) => {
		const absolute = await privatePath(relative);
		if (await privatePathHasSymlink(absolute)) throw new Error('private-storage.symlink');
		return absolute;
	};
	const tighten = async (absolute: string, relative: string, bits: number) => {
		try { await chmod(absolute, bits); }
		catch (error) { report(relative, code(error)); }
	};
	const directories = async (relative: string) => {
		await check(relative);
		let current = '';
		for (const part of relative.replaceAll('\\', '/').split('/').filter(part => part && part !== '.')) {
			current = current ? `${current}/${part}` : part;
			const absolute = await check(current);
			try { await mkdir(absolute, { mode: PRIVATE_DIR_MODE }); }
			catch (error) { if (code(error) !== 'EEXIST') throw error; }
			const stat = await metadata(absolute);
			if (stat?.isSymbolicLink()) throw new Error('private-storage.symlink');
			if (!stat?.isDirectory()) throw new Error('private-storage.directory');
			await tighten(absolute, current, PRIVATE_DIR_MODE);
		}
	};
	const repair = async () => {
		// Only NAND-owned subtrees; bounded traversal runs once for this adapter.
		let remaining = 20_000;
		const visit = async (relative: string, depth: number): Promise<void> => {
			if (--remaining < 0 || depth > 32) { report(relative, 'repair-limit'); return; }
			try {
				const absolute = await check(relative);
				const stat = await metadata(absolute);
				if (!stat) return;
				if (!stat.isDirectory() && !stat.isFile()) { report(relative, 'file-type'); return; }
				await tighten(absolute, relative, stat.isDirectory() ? PRIVATE_DIR_MODE : PRIVATE_FILE_MODE);
				if (stat.isDirectory()) {
					const entries = await opendir(absolute);
					for await (const entry of entries) {
						if (remaining <= 0) { report(relative, 'repair-limit'); break; }
						await visit(`${relative}/${entry.name}`, depth + 1);
					}
				}
			} catch (error) { report(relative, error instanceof Error && error.message.startsWith('private-storage.') ? error.message : code(error)); }
		};
		try { await directories('.nand'); }
		catch (error) { report('.nand', error instanceof Error && error.message.startsWith('private-storage.') ? error.message : code(error)); return; }
		for (const directory of MANAGED_DIRECTORIES) await visit(`.nand/${directory}`, 0);
	};
	const ready = repair();
	return {
		async exists(relative) { await ready; if (isPrivateRelative(relative)) await check(relative); return inner.exists(relative); },
		async read(relative) { await ready; if (isPrivateRelative(relative)) await check(relative); return inner.read(relative); },
		async mkdir(relative) {
			await ready;
			if (!isPrivateRelative(relative)) return inner.mkdir(relative);
			await directories(relative);
		},
		async write(relative, content) {
			await ready;
			if (!isPrivateRelative(relative)) return inner.write(relative, content);
			const absolute = await check(relative);
			await directories(path.posix.dirname(relative.replaceAll('\\', '/')));
			// Create with 0600 before the adapter receives any private bytes.
			const file = await open(absolute, constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW, PRIVATE_FILE_MODE);
			try {
				if (!(await file.stat()).isFile()) throw new Error('private-storage.file-type');
				try { await file.chmod(PRIVATE_FILE_MODE); } catch (error) { report(relative, code(error)); }
			} finally { await file.close(); }
			await inner.write(relative, content);
			await check(relative);
			await tighten(absolute, relative, PRIVATE_FILE_MODE);
		},
	};
}
