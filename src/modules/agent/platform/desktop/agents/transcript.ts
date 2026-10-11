import path from 'node:path';
import { lstat, realpath } from 'node:fs/promises';
import { absoluteNandPath } from '../../../../../host/desktop/nand-paths';
import { t } from '../../../../../shared/i18n';

/** A saved transcript is data in this account, never an arbitrary file supplied by synchronized metadata. */
export async function checkAccountTranscript(vault: string, env: Record<string, string>, transcript: string | undefined): Promise<void> {
	if (!transcript) return;
	const root = await realpath(vault), aliasTail = path.relative(vault, transcript);
	// Canonicalize the vault alias only; resolving a transcript's realpath would hide inner links.
	const target = aliasTail !== '..' && !aliasTail.startsWith('..' + path.sep) && !path.isAbsolute(aliasTail) ? path.join(root, aliasTail) : transcript;
	const relative = path.relative(env.NAND_ACCOUNT_ROOT!, target);
	if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error(t('agent.sessionMissing'));
	const file = await absoluteNandPath(root, path.relative(root, target).split(path.sep).join('/'));
	if (!(await lstat(file)).isFile()) throw new Error(t('agent.sessionMissing'));
}
