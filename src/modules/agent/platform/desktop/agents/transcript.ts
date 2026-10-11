import path from 'node:path';
import { lstat } from 'node:fs/promises';
import { absoluteNandPath } from '../../../../../host/desktop/nand-paths';
import { t } from '../../../../../shared/i18n';

/** A saved transcript is data in this account, never an arbitrary file supplied by synchronized metadata. */
export async function checkAccountTranscript(vault: string, env: Record<string, string>, transcript: string | undefined): Promise<void> {
	if (!transcript) return;
	const relative = path.relative(env.NAND_ACCOUNT_ROOT!, transcript);
	if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error(t('agent.sessionMissing'));
	const file = await absoluteNandPath(vault, path.relative(vault, transcript).split(path.sep).join('/'));
	if (!(await lstat(file)).isFile()) throw new Error(t('agent.sessionMissing'));
}
