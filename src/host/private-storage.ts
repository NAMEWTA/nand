import type { TextStorage } from '../shared/storage/ports';

/**
 * Use the POSIX private-storage port when a desktop vault root exists.
 * The desktop module, and its Node imports, load only on that path.
 */
export function privateStorageIfDesktop(inner: TextStorage, vaultRoot: string): TextStorage {
	if (!vaultRoot) return inner;
	let wrapped: TextStorage | undefined;
	const ready = import('./desktop/private-mode').then((mod) => {
		wrapped = mod.privateTextStorage(inner, vaultRoot);
		return wrapped;
	});
	const current = () => wrapped ?? ready;
	return {
		exists: async (relative) => (await current()).exists(relative),
		read: async (relative) => (await current()).read(relative),
		write: async (relative, content) => (await current()).write(relative, content),
		mkdir: async (relative) => (await current()).mkdir(relative),
	};
}
