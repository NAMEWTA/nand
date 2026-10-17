// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { TFile, TFolder, normalizePath, type App } from 'obsidian';

/** Folder of Obsidian's Templates core plugin, where the Daily notes core plugin's template name is looked up. */
export function coreTemplatesFolder(app: App): string {
	const internal = (app as unknown as { internalPlugins?: { getPluginById?: (id: string) => { enabled?: boolean; instance?: { options?: { folder?: string } } } | undefined } }).internalPlugins;
	const plugin = internal?.getPluginById?.('templates');
	return plugin?.enabled ? (plugin.instance?.options?.folder ?? '').trim().replace(/^\/+|\/+$/g, '') : '';
}

/** A template note by the path the user wrote: as given, or inside one of the template folders. */
export function resolveTemplateFile(app: App, templateFolders: string | readonly string[], template: string): TFile | undefined {
	const name = template.trim();
	if (!name) return undefined;
	const withExt = name.toLowerCase().endsWith('.md') ? name : `${name}.md`;
	const folders = (typeof templateFolders === 'string' ? [templateFolders] : templateFolders).filter(Boolean);
	const candidates = [withExt, ...folders.map((folder) => `${folder.replace(/\/+$/, '')}/${withExt}`)];
	for (const candidate of candidates) {
		const file = app.vault.getAbstractFileByPath(normalizePath(candidate));
		if (file instanceof TFile) return file;
	}
	return undefined;
}

/** Markdown notes in the template folder (all notes when no folder is set), as vault paths. */
export function listTemplateFiles(app: App, templateFolder: string): string[] {
	const root = templateFolder ? app.vault.getAbstractFileByPath(normalizePath(templateFolder)) : app.vault.getRoot();
	if (!(root instanceof TFolder)) return [];
	const found: string[] = [];
	const walk = (folder: TFolder) => {
		for (const child of folder.children) {
			if (child instanceof TFolder) walk(child);
			else if (child instanceof TFile && child.extension === 'md') found.push(child.path);
		}
	};
	walk(root);
	return found.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

interface TemplaterPlugin {
	templater?: {
		create_new_note_from_template?: (template: TFile, folder?: TFolder | string, filename?: string, openNewNote?: boolean) => Promise<TFile | undefined>;
	};
}

/** The Templater plugin's API when it is installed and enabled. */
export function templaterApi(app: App): Required<NonNullable<TemplaterPlugin['templater']>> | undefined {
	const plugins = (app as unknown as { plugins?: { plugins?: Record<string, TemplaterPlugin | undefined> } }).plugins?.plugins;
	const api = plugins?.['templater-obsidian']?.templater;
	return api?.create_new_note_from_template ? (api as Required<NonNullable<TemplaterPlugin['templater']>>) : undefined;
}

export const isTemplaterInstalled = (app: App): boolean => templaterApi(app) !== undefined;
