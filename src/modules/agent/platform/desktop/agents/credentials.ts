import * as path from 'node:path';
import { lstat, readdir } from 'node:fs/promises';
import type { AgentCatalogEntry } from '../../../core/launch/catalog';
import type { AgentId } from '../../../core/launch/types';
import { accountPaths, historySource, type AccountPaths } from './system-homes';

/** Files that hold a provider login, relative to the paths a provider resolves. */
export function credentialFiles(agent: AgentId, paths: AccountPaths): string[] {
	switch (agent) {
		case 'claude-code': return [path.join(paths.CLAUDE_CONFIG_DIR, '.credentials.json'), path.join(paths.CLAUDE_CONFIG_DIR, '.claude.json')];
		case 'codex': return [path.join(paths.CODEX_HOME, 'auth.json')];
		case 'grok': return [path.join(paths.GROK_HOME, 'auth.json')];
		case 'gemini': return [path.join(paths.GEMINI_CLI_HOME, '.gemini', 'oauth_creds.json'), path.join(paths.GEMINI_CLI_HOME, '.gemini', 'google_accounts.json')];
		case 'pi': return [path.join(paths.PI_CODING_AGENT_DIR, 'auth.json')];
		case 'opencode': return [path.join(paths.XDG_DATA_HOME, 'opencode', 'auth.json')];
	}
}

async function isFile(file: string): Promise<boolean> {
	try { return (await lstat(file)).isFile(); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}

/** Whether a managed account directory holds a login or any session history (the former vault default account is kept only if it does). */
export async function managedAccountHasData(agent: AgentCatalogEntry, env: Record<string, string>): Promise<boolean> {
	const paths = accountPaths(env);
	for (const file of credentialFiles(agent.id, paths)) if (await isFile(file)) return true;
	const source = historySource(agent.id, paths);
	try { return (await lstat(source)).isFile() || (await readdir(source)).length > 0; }
	catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
