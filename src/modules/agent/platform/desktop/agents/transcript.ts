import path from 'node:path';
import { lstat, realpath } from 'node:fs/promises';
import { absoluteNandPath } from '../../../../../host/desktop/nand-paths';
import { t } from '../../../../../shared/i18n';
import { historyBase, historySource, systemAccountAgent, systemAccountPaths } from './system-homes';

/** A system-account transcript is the user's own file under the provider's history directory, reached without following links below it. */
export async function checkSystemTranscript(env: Record<string, string>, transcript: string): Promise<void> {
	const agent = systemAccountAgent(env);
	if (!agent) throw new Error(t('agent.sessionMissing'));
	const paths = systemAccountPaths(), base = path.resolve(historyBase(agent, paths)), source = path.resolve(historySource(agent, paths)), resolved = path.resolve(transcript);
	const inside = (root: string) => { const tail = path.relative(root, resolved); return !!tail && tail !== '..' && !tail.startsWith('..' + path.sep) && !path.isAbsolute(tail); };
	const name = path.basename(resolved);
	// Only a session log is a transcript; a login file next to the history directory is never readable through this check.
	const allowed = agent === 'opencode' ? resolved === source
		: !inside(source) ? false
		: agent === 'grok' ? name === 'session.json'
		: agent === 'gemini' ? /\.jsonl?$/.test(name) && path.basename(path.dirname(resolved)) === 'chats'
		: name.endsWith('.jsonl');
	const relative = path.relative(base, resolved);
	if (!allowed || !relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error(t('agent.sessionMissing'));
	let current = base;
	for (const part of relative.split(path.sep)) {
		current = path.join(current, part);
		if ((await lstat(current)).isSymbolicLink()) throw new Error(t('agent.sessionMissing'));
	}
	if (!(await lstat(current)).isFile()) throw new Error(t('agent.sessionMissing'));
}

/** A saved transcript is data in this account, never an arbitrary file supplied by synchronized metadata. */
export async function checkAccountTranscript(vault: string, env: Record<string, string>, transcript: string | undefined): Promise<void> {
	if (!transcript) return;
	if (systemAccountAgent(env)) return checkSystemTranscript(env, transcript);
	const root = await realpath(vault), aliasTail = path.relative(vault, transcript);
	// Canonicalize the vault alias only; resolving a transcript's realpath would hide inner links.
	const target = aliasTail !== '..' && !aliasTail.startsWith('..' + path.sep) && !path.isAbsolute(aliasTail) ? path.join(root, aliasTail) : transcript;
	const relative = path.relative(env.NAND_ACCOUNT_ROOT!, target);
	if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error(t('agent.sessionMissing'));
	const file = await absoluteNandPath(root, path.relative(root, target).split(path.sep).join('/'));
	if (!(await lstat(file)).isFile()) throw new Error(t('agent.sessionMissing'));
}
