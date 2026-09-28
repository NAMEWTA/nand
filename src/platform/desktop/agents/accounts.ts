import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AgentCatalogEntry } from '../../../core/agent-launch/catalog';
import { runtimeProcess } from './runtime-process';

export function accountConfigDir(kind: 'claude' | 'codex', accountId: string, pluginDataDir: string): string | null {
	const id = accountId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
	if (!id || !pluginDataDir) return null;
	return path.join(pluginDataDir, 'accounts', kind, id, 'home');
}

export function accountEnv(agent: AgentCatalogEntry, accountId: string, pluginDataDir: string): Record<string, string> {
	if (agent.accountKind === 'none') {
		if (agent.id === 'pi')
			return {
				PI_CODING_AGENT_DIR:
					runtimeProcess().env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent'),
			};
		if (agent.id === 'grok')
			return { GROK_HOME: runtimeProcess().env.GROK_HOME || path.join(os.homedir(), '.grok') };
		return {};
	}
	const selected = accountConfigDir(agent.accountKind, accountId, pluginDataDir);
	const home =
		selected ||
		(agent.accountKind === 'codex' ? runtimeProcess().env.CODEX_HOME : runtimeProcess().env.CLAUDE_CONFIG_DIR) ||
		path.join(os.homedir(), agent.accountKind === 'codex' ? '.codex' : '.claude');
	if (selected) fs.mkdirSync(home, { recursive: true });
	if (agent.accountKind === 'codex') {
		return { CODEX_HOME: home };
	}
	return { CLAUDE_CONFIG_DIR: home };
}
/** Resolve host-relative plugin paths once, before selecting native credentials. */
export function absolutePluginDir(vault: string, dir: string): string {
	return path.isAbsolute(dir) ? dir : path.resolve(vault, dir);
}
