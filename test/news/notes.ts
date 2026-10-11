import type { TextStorage } from '../../src/shared/storage/ports';
import type { NewsNotePort } from '../../src/modules/news/platform/note-port';

export function memoryNotes(storage: TextStorage & { files: Map<string, string> }): NewsNotePort {
	return {
		paths: () => [...storage.files.keys()].filter(path => path.startsWith('NAND/新闻/') && path.endsWith('.md')),
		read: path => storage.read(path),
		async process(path, update) {
			const text = update(storage.files.get(path) ?? null);
			await storage.write(path, text);
			return text;
		},
		subscribe: () => () => undefined,
	};
}
