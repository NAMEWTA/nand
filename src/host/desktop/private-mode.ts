import path from 'node:path';
import type { TextStorage } from '../../shared/storage/ports';

/** POSIX private-data modes. Windows and other non-POSIX hosts never chmod. */
export const PRIVATE_DIR_MODE = 0o700;
export const PRIVATE_FILE_MODE = 0o600;

export function chmodAllowed(platform: string): boolean {
	return platform !== 'win32' && platform !== 'android' && platform !== 'ios';
}

export function isPrivateRelative(vaultPath: string): boolean {
	const normalized = vaultPath.replaceAll('\\', '/').replace(/^\.\//, '');
	return normalized === '.nand' || normalized.startsWith('.nand/');
}

function hostPlatform(): string {
	return typeof process === 'undefined' ? 'unknown' : process.platform;
}

async function filesystem() {
	return import('node:fs/promises');
}

/** True when any existing ancestor of `absolute` is a symlink. */
export async function privatePathHasSymlink(absolute: string): Promise<boolean> {
	if (!chmodAllowed(hostPlatform())) return false;
	const { lstat } = await filesystem();
	const root = path.parse(absolute).root;
	let current = root;
	for (const part of path.relative(root, absolute).split(path.sep).filter(Boolean)) {
		current = path.join(current, part);
		try {
			if ((await lstat(current)).isSymbolicLink()) return true;
		} catch {
			return false;
		}
	}
	return false;
}

/** chmod one existing path. A symlink is left untouched, including its target. */
export async function tightenPrivateAbsolute(absolute: string, kind: 'dir' | 'file'): Promise<'applied' | 'symlink' | 'skipped' | 'failed'> {
	if (!chmodAllowed(hostPlatform())) return 'skipped';
	try {
		const { lstat, chmod } = await filesystem();
		const stat = await lstat(absolute);
		if (stat.isSymbolicLink()) return 'symlink';
		await chmod(absolute, kind === 'dir' ? PRIVATE_DIR_MODE : PRIVATE_FILE_MODE);
		return 'applied';
	} catch {
		return 'failed';
	}
}

/** chmod each existing private directory from `.nand` through `relative`. */
export async function tightenPrivateAncestors(vaultRoot: string, relative: string): Promise<void> {
	const parts = relative.replaceAll('\\', '/').split('/').filter(Boolean);
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (isPrivateRelative(current)) await tightenPrivateAbsolute(path.resolve(vaultRoot, current), 'dir');
	}
}

/**
 * Wrap text storage so new `.nand` directories and files are private on POSIX.
 * Symlink ancestors are not created through and are not chmodded.
 */
export function privateTextStorage(inner: TextStorage, vaultRoot: string): TextStorage {
	const absolute = (relative: string) => path.resolve(vaultRoot, relative);
	return {
		exists: (relative) => inner.exists(relative),
		read: (relative) => inner.read(relative),
		async mkdir(relative) {
			if (isPrivateRelative(relative) && (await privatePathHasSymlink(absolute(relative)))) return;
			await inner.mkdir(relative);
			if (isPrivateRelative(relative)) await tightenPrivateAncestors(vaultRoot, relative);
		},
		async write(relative, content) {
			if (isPrivateRelative(relative) && (await privatePathHasSymlink(absolute(relative)))) throw new Error('private-storage.symlink');
			await inner.write(relative, content);
			if (!isPrivateRelative(relative)) return;
			await tightenPrivateAncestors(vaultRoot, path.posix.dirname(relative.replaceAll('\\', '/')));
			await tightenPrivateAbsolute(absolute(relative), 'file');
		},
	};
}
