import { lstat, mkdir, realpath } from 'node:fs/promises';
import * as path from 'node:path';
import { AutomationError } from '../../../../shared/automation/errors';

const inside = (root: string, target: string) => {
	const relative = path.relative(root, target);
	return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
const unsafe = () => new AutomationError('precheckDirectoryUnsafe');

/** The vault itself is canonical; every component inside its owned tree must be a real directory. */
async function checkChain(root: string, directory: string, allowMissing = false): Promise<void> {
	const owned = path.join(root, '.nand');
	if (!inside(owned, directory)) throw unsafe();
	const rootInfo = await lstat(root);
	if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory() || path.relative(root, await realpath(root)) !== '')
		throw unsafe();
	let current = root;
	for (const part of path.relative(root, directory).split(path.sep)) {
		current = path.join(current, part);
		let info;
		try {
			info = await lstat(current);
		} catch (error) {
			if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
			throw error;
		}
		if (info.isSymbolicLink() || !info.isDirectory() || !inside(owned, await realpath(current))) throw unsafe();
	}
}

/** No recursive mkdir: reject existing links before creating any descendant through them. */
export async function preparePrecheckDirectories(root: string, directories: readonly string[]): Promise<void> {
	const pending = new Set<string>();
	for (const directory of directories) {
		await checkChain(root, directory, true);
		let current = root;
		for (const part of path.relative(root, directory).split(path.sep)) {
			current = path.join(current, part);
			pending.add(current);
		}
	}
	for (const directory of [...pending].sort((a, b) => a.length - b.length)) {
		// Re-read all ancestors before each creation, including a parent prepared above.
		await checkChain(root, directory, true);
		try {
			await mkdir(directory, { mode: 0o700 });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		}
		await checkChain(root, directory);
	}
}

/** Revalidate on every launch, including directories that already existed on a previous run. */
export async function checkPrecheckDirectories(root: string, directories: readonly string[]): Promise<void> {
	for (const directory of directories) await checkChain(root, directory);
}
