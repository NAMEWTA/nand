import type { App } from 'obsidian';
import { deviceId } from '../../../host/obsidian/storage/device-id';
import { CONTENT_ROOT } from '../../../shared/storage/content-paths';
import { workspaceFolder } from '../core/workspace/location';
import { BrowserError } from '../core/model';

/** New writes use the canonical folder. Legacy snapshots remain read-only until explicitly restored. */
export async function recoveryLocations(app: App, root: string, kind: 'workspace' | 'assistant'): Promise<Array<{ directory: string; key: string }>> {
	const folder = workspaceFolder(root);
	if (!folder) throw new BrowserError('browser_workspace_folder');
	const folders = [folder, folder.slice(CONTENT_ROOT.length + 1)];
	return Promise.all(folders.map(async value => {
		const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
		return { directory: `.nand/recovery/drafts/browser${kind === 'assistant' ? '-assistant' : ''}-${deviceId(app)}-${hash}`, key: `browser/${kind}-documents/${encodeURIComponent(value)}.json` };
	}));
}
