import { Platform } from 'obsidian';
import { t } from '../../../../../shared/i18n/index';

/** Node modules for the history scan, loaded only at the desktop execution boundary. */
export async function historyNodeModules() {
	if (!Platform.isDesktop) throw new Error(t('agent.sessionMissing'));
	return Promise.resolve([
		window.require('node:path') as typeof import('node:path'),
		window.require('node:os') as typeof import('node:os'),
		window.require('node:fs/promises') as typeof import('node:fs/promises'),
		window.require('node:process') as typeof import('node:process'),
	] as const);
}

/** Whether `target` is a regular file; rejects when it does not exist. */
export async function isFile(target: string): Promise<boolean> {
	const [, , fs] = await historyNodeModules();
	return (await fs.stat(target)).isFile();
}
