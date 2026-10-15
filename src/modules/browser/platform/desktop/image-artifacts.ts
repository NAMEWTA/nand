import type { App } from 'obsidian';
import { Buffer } from 'node:buffer';
import { join } from 'node:path';
import { privateVaultStorage } from '../../../../host/obsidian/storage/private-storage';
import { deviceId } from '../../../../host/obsidian/storage/device-id';
import { promises as fs } from 'node:fs';
import { desktopVaultRoot } from '../../../../host/obsidian/storage/private-storage';
import { BrowserError } from '../../core/model';

/** Save captured material directly for the selected agent session. */
export async function saveBrowserImage(app: App, dataUrl: string, description?: string): Promise<string[]> {
	if (!/^data:image\/png;base64,[A-Za-z\d+/=]+$/.test(dataUrl)) throw new BrowserError('browser_invalid_image');
	const root = desktopVaultRoot(app);
	const files = privateVaultStorage(app);
	await files.mkdir(`.nand/browser/${deviceId(app)}/artifacts`);
	const base = `.nand/browser/${deviceId(app)}/artifacts/${crypto.randomUUID()}`;
	const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
	await fs.writeFile(join(root, `${base}.png`), bytes);
	if (!description) return [join(root, `${base}.png`)];
	await files.write(`${base}.txt`, description);
	return [join(root, `${base}.txt`), join(root, `${base}.png`)];
}
