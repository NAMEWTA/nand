// Real-home resolution follows stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/main/claude-accounts/claude-profile-router.ts (systemDefaultHome), src/main/codex-accounts/runtime-home-service-home-routing.ts
import * as os from 'node:os';
import * as path from 'node:path';
import type { AgentId } from '../../../core/launch/types';
import { recoveredLoginEnvironment } from '../detection/shell-path';

/** Variables that tell a provider CLI where its own data lives, named as the managed accounts name them. */
export const ACCOUNT_PATH_KEYS = [
	'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'GROK_HOME', 'GEMINI_CLI_HOME', 'PI_CODING_AGENT_DIR', 'PI_CODING_AGENT_SESSION_DIR',
	'OPENCODE_CONFIG_DIR', 'XDG_DATA_HOME', 'XDG_CONFIG_HOME',
] as const;
export type AccountPaths = Readonly<Record<typeof ACCOUNT_PATH_KEYS[number], string>>;

export const SYSTEM_ACCOUNT_SUFFIX = '/system';

/** A system account is the identity the user already has on this machine: no HOME or CLI-home override, no credential changes. */
export function isSystemAccount(env: Readonly<Record<string, string>>): boolean {
	return typeof env.NAND_ACCOUNT_ID === 'string' && env.NAND_ACCOUNT_ID.endsWith(SYSTEM_ACCOUNT_SUFFIX);
}

function pick(source: Readonly<Record<string, string | undefined>>, key: string): string | undefined {
	const value = source[key];
	return value && path.isAbsolute(value) ? value : undefined;
}

/**
 * Where each provider reads and writes when it inherits this process: an exported CLI-home variable wins,
 * otherwise the conventional dotfile directory of the real user home.
 */
export function systemAccountPaths(
	source: Readonly<Record<string, string | undefined>> = process.env,
	home: string = os.homedir(),
): AccountPaths {
	// A desktop-icon launch lacks rc exports; the recovered login-shell values fill exactly those gaps.
	const merged = { ...recoveredLoginEnvironment(), ...Object.fromEntries(Object.entries(source).filter(([, value]) => !!value)) } as Record<string, string | undefined>;
	const value = (key: string, fallback: string) => pick(merged, key) ?? fallback;
	const piAgent = value('PI_CODING_AGENT_DIR', path.join(home, '.pi', 'agent'));
	const xdgConfig = value('XDG_CONFIG_HOME', path.join(home, '.config'));
	return {
		CLAUDE_CONFIG_DIR: value('CLAUDE_CONFIG_DIR', path.join(home, '.claude')),
		CODEX_HOME: value('CODEX_HOME', path.join(home, '.codex')),
		GROK_HOME: value('GROK_HOME', path.join(home, '.grok')),
		GEMINI_CLI_HOME: value('GEMINI_CLI_HOME', home),
		PI_CODING_AGENT_DIR: piAgent,
		PI_CODING_AGENT_SESSION_DIR: value('PI_CODING_AGENT_SESSION_DIR', path.join(piAgent, 'sessions')),
		OPENCODE_CONFIG_DIR: value('OPENCODE_CONFIG_DIR', path.join(xdgConfig, 'opencode')),
		XDG_DATA_HOME: value('XDG_DATA_HOME', path.join(home, '.local', 'share')),
		XDG_CONFIG_HOME: xdgConfig,
	};
}

/** Resolved paths for any account env: the real homes for a system account, the account's own variables otherwise. */
export function accountPaths(env: Readonly<Record<string, string>>): AccountPaths {
	if (isSystemAccount(env)) return systemAccountPaths();
	return Object.fromEntries(ACCOUNT_PATH_KEYS.map(key => [key, env[key] ?? ''])) as AccountPaths;
}

/** The directory a provider's history and usage live under; a transcript must stay inside it. */
export function historyBase(agent: AgentId, paths: AccountPaths): string {
	switch (agent) {
		case 'claude-code': return paths.CLAUDE_CONFIG_DIR;
		case 'codex': return paths.CODEX_HOME;
		case 'grok': return paths.GROK_HOME;
		case 'gemini': return path.join(paths.GEMINI_CLI_HOME, '.gemini');
		case 'pi': return paths.PI_CODING_AGENT_SESSION_DIR;
		case 'opencode': return path.join(paths.XDG_DATA_HOME, 'opencode');
	}
}

/** Where a provider keeps session history; a directory, or the database file for opencode. */
export function historySource(agent: AgentId, paths: AccountPaths): string {
	switch (agent) {
		case 'claude-code': return path.join(paths.CLAUDE_CONFIG_DIR, 'projects');
		case 'codex': return path.join(paths.CODEX_HOME, 'sessions');
		case 'gemini': return path.join(paths.GEMINI_CLI_HOME, '.gemini', 'tmp');
		case 'pi': return paths.PI_CODING_AGENT_SESSION_DIR;
		case 'grok': return path.join(paths.GROK_HOME, 'sessions');
		case 'opencode': return path.join(paths.XDG_DATA_HOME, 'opencode', 'opencode.db');
	}
}

/** Locations shown to the user for the system account, home-relative where possible. */
export function systemAccountLocation(agent: AgentId, home: string = os.homedir()): string {
	const base = historyBase(agent, systemAccountPaths(undefined, home));
	const relative = path.relative(home, base);
	return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? path.join('~', relative) : base;
}

/** Provider of a system account env (`<provider>/system`). */
export function systemAccountAgent(env: Readonly<Record<string, string>>): AgentId | undefined {
	const id = env.NAND_ACCOUNT_ID;
	return typeof id === 'string' && id.endsWith(SYSTEM_ACCOUNT_SUFFIX) ? id.slice(0, -SYSTEM_ACCOUNT_SUFFIX.length) as AgentId : undefined;
}
