import type { TextStorage } from '../shared/storage/ports';
import { storageWriteQueue } from '../shared/storage/write-queue';

const ports = new WeakMap<TextStorage, TextStorage>();

/**
 * Use the POSIX private-storage port when a desktop vault root exists.
 * The desktop module, and its Node imports, load only on that path.
 */
export function privateStorageIfDesktop(inner: TextStorage, vaultRoot: string): TextStorage {
	if (!vaultRoot) return inner;
	const existing = ports.get(inner);
	if (existing) return existing;
	let wrapped: TextStorage | undefined;
	const ready = import('./desktop/private-mode').then((mod) => {
		wrapped = mod.privateTextStorage(inner, vaultRoot);
		return wrapped;
	});
	const current = () => wrapped ?? ready;
	const port: TextStorage = {
		exists: async (relative) => (await current()).exists(relative),
		read: async (relative) => (await current()).read(relative),
		write: async (relative, content) => (await current()).write(relative, content),
		mkdir: async (relative) => (await current()).mkdir(relative),
	};
	Object.defineProperty(port, Symbol.for('nand.storage.write-queue'), { value: storageWriteQueue(inner) });
	ports.set(inner, port);
	return port;
}
