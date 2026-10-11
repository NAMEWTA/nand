import { App } from 'obsidian';
import { contentFiles, type ContentFile } from '../../../../host/obsidian/storage/content-files';

/** Rename a media file; fileManager.renameFile updates all [[links]]/![[embeds]] automatically. */
export async function renameMediaFile(app: App, file: ContentFile, newBasename: string): Promise<void> {
	const name = newBasename.trim();
	if (!name || name === file.basename) return;
	const parentPath = file.path.split('/').slice(0, -1).join('/');
	const newPath = parentPath ? `${parentPath}/${name}.${file.extension}` : `${name}.${file.extension}`;
	await contentFiles(app).rename(file, newPath);
}

/** Move a media file to the trash (recoverable) via the file manager so the
 *  user's "delete to trash vs permanent" preference is respected. */
export async function trashMediaFile(app: App, file: ContentFile): Promise<void> {
	await contentFiles(app).trash(file);
}
