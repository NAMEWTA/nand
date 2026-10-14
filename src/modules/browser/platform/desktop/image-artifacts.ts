import type { App } from 'obsidian';
import { Buffer } from 'node:buffer';
import { join } from 'node:path';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
import { desktopVaultRoot } from '../../../../host/obsidian/storage/private-storage';
import { BrowserError } from '../../core/model';

/** Save captured material directly for the selected agent session. */
export async function saveBrowserImage(app: App, dataUrl: string, description?: string): Promise<string[]> {
	if (!/^data:image\/png;base64,[A-Za-z\d+/=]+$/.test(dataUrl)) throw new BrowserError('browser_invalid_image');
	const root = desktopVaultRoot(app);
	const files = contentFiles(app);
	const base = `.nand/content/NAND/浏览器/附件/${crypto.randomUUID()}`;
	const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
	await files.createBinary(`${base}.png`, Uint8Array.from(bytes).buffer);
	if (!description) return [join(root, `${base}.png`)];
	await files.create(`${base}.txt`, description);
	return [join(root, `${base}.txt`), join(root, `${base}.png`)];
}
