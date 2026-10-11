import { MarkdownView, TFile, type App } from 'obsidian';
import type { DocumentPort } from '../../../shared/storage/document-repository';
import { ensureDirectory } from '../../../shared/storage/durable-state';
import { NEWS_NOTES_ROOT } from './notes';
import { favoriteFolder, editionFolder, newsFolder, type NewsNoteFolders } from '../core/note-folders';

export interface NewsNotePort extends DocumentPort {
	paths(): readonly string[];
	subscribe(listener: () => void): () => void;
}

/** Visible Markdown uses the Vault API, including its atomic process and editor protection. */
export function newsNotePort(app: App, folders: () => NewsNoteFolders = () => ({})): NewsNotePort {
	let known = new Set<string>();
	const tagged = (path: string): boolean => {
		const file = app.vault.getAbstractFileByPath(path);
		const kind: unknown = file instanceof TFile ? app.metadataCache.getFileCache(file)?.frontmatter?.['nand-type'] : undefined;
		return kind === 'news' || kind === 'news-brief' || kind === 'news-edition';
	};
	const owns = (path: string): boolean => !!newsFolder(path) && path.endsWith('.md') &&
		(known.has(path) || tagged(path) || [NEWS_NOTES_ROOT, favoriteFolder(folders()), editionFolder(folders())].some(root => path.startsWith(`${root}/`)));
	return {
		paths: () => { const paths = app.vault.getMarkdownFiles().filter(file => owns(file.path)).map(file => file.path); known = new Set(paths); return paths; },
		read: async path => {
			const file = app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) throw new Error('news.note.missing');
			return app.vault.read(file);
		},
		process: async (path, update) => {
			if (!owns(path)) throw new Error('news.note.path');
			const file = app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				return app.vault.process(file, current => {
					for (const leaf of app.workspace.getLeavesOfType('markdown')) {
						if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path && leaf.view.editor.getValue() !== current) throw new Error('news.note.unsaved');
					}
					return update(current);
				});
			}
			if (file) throw new Error('news.note.path');
			const text = update(null);
			await ensureDirectory(app.vault.adapter, path.slice(0, path.lastIndexOf('/')));
			await app.vault.create(path, text);
			return text;
		},
		subscribe: listener => {
			const changed = (file: { path: string }): void => { if (owns(file.path)) listener(); };
			const refs = [app.vault.on('create', changed), app.vault.on('modify', changed), app.vault.on('delete', changed),
				app.vault.on('rename', (file, old) => { if (owns(file.path) || owns(old)) listener(); })];
			const metadata = app.metadataCache.on('changed', file => { if (owns(file.path)) listener(); });
			return () => { for (const ref of refs) app.vault.offref(ref); app.metadataCache.offref(metadata); known.clear(); };
		},
	};
}
