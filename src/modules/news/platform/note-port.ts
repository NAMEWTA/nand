import type { App } from 'obsidian';
import { contentFiles } from '../../../host/obsidian/storage/content-files';
import { isContentPath } from '../../../shared/storage/content-paths';
import type { DocumentPort } from '../../../shared/storage/document-repository';
import { parseDocumentValue } from '../../../shared/storage/document-repository';
import { NEWS_NOTES_ROOT } from './notes';
import { favoriteFolder, editionFolder, type NewsNoteFolders } from '../core/note-folders';

export interface NewsNotePort extends DocumentPort {
	refresh?(): Promise<void>;
	paths(): readonly string[];
	subscribe(listener: () => void): () => void;
}

/** Hidden Markdown is indexed independently of Obsidian's visible-file metadata cache. */
export function newsNotePort(app: App, folders: () => NewsNoteFolders = () => ({})): NewsNotePort {
	const files = contentFiles(app), tags = new Map<string, { stamp: string; news: boolean }>();
	let known = new Set<string>();
	const inFolder = (path: string) => [NEWS_NOTES_ROOT, favoriteFolder(folders()), editionFolder(folders())].some(root => path.startsWith(root + '/'));
	const owns = (path: string) => isContentPath(path) && path.endsWith('.md') && (known.has(path) || inFolder(path));
	return {
		refresh: async () => {
			await files.refresh();
			const next = new Set<string>();
			for (const file of files.allManaged()) {
				if (file.extension !== 'md') continue;
				if (inFolder(file.path)) { next.add(file.path); continue; }
				const stamp = `${file.stat.mtime}:${file.stat.size}`, previous = tags.get(file.path);
				let news = previous?.news ?? false;
				if (previous?.stamp !== stamp) {
					const text = await files.read(file);
					try { news = ['news', 'news-brief', 'news-edition'].includes(String(parseDocumentValue(text).properties['nand-type'])); }
					catch { news = news || /^nand-type:\s*news(?:-brief|-edition)?\s*$/m.test(text); }
					tags.set(file.path, { stamp, news });
				}
				if (news) next.add(file.path);
			}
			for (const path of tags.keys()) if (!files.getFileByPath(path)) tags.delete(path);
			known = next;
		},
		paths: () => [...known],
		read: path => files.read(path),
		process: async (path, update) => {
			if (!owns(path)) throw new Error('news.note.path');
			return files.process(path, update);
		},
		subscribe: listener => files.subscribe(event => {
			if ([event.path, event.oldPath ?? ''].some(path => isContentPath(path) && path.endsWith('.md'))) {
				tags.delete(event.path); if (event.oldPath) tags.delete(event.oldPath);
				listener();
			}
		}),
	};
}
