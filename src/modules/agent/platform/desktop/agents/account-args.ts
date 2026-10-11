import path from 'node:path';
import type { AgentId } from '../../../core/launch/types';

/** Provider storage overrides follow user flags so imported configuration cannot move managed data out. */
export function accountArgs(agent: AgentId, args: string[], env: Record<string, string>): string[] {
	if (agent !== 'codex') return args;
	const boundary = args.indexOf('--'), before = boundary < 0 ? args : args.slice(0, boundary), after = boundary < 0 ? [] : args.slice(boundary);
	return [...before, '-c', 'cli_auth_credentials_store="file"', '-c', 'mcp_oauth_credentials_store="file"', '-c', 'sqlite_home=' + JSON.stringify(env.CODEX_HOME), '-c', 'log_dir=' + JSON.stringify(path.join(env.CODEX_HOME!, 'log')), ...after];
}
