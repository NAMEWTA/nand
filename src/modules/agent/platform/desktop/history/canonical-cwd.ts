import { Platform } from 'obsidian';
import { t } from '../../../../../shared/i18n/index';
import { isCwdInsideVault } from './scope';

/** Validate real directories at the execution boundary, including symlink escapes. */
export async function canonicalVaultCwd(vault: string, cwd: string): Promise<string> {
	if (!Platform.isDesktop) throw new Error(t('agent.sessionMissing'));
	const fs = window.require('node:fs/promises') as typeof import('node:fs/promises');
	const process = window.require('node:process') as typeof import('node:process');
	const [root, target] = await Promise.all([fs.realpath(vault), fs.realpath(cwd)]);
	if (!isCwdInsideVault(root, target, process.platform) || !(await fs.stat(target)).isDirectory())
		throw new Error(t('agent.outsideVault'));
	return target;
}
