import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { AgentCatalogEntry } from '../../../core/launch/catalog';
import type { AgentId } from '../../../core/launch/types';
import { accountName } from '../../../core/launch/account-name';
import { absoluteNandPath } from '../../../../../host/desktop/nand-paths';
import { nativeVaultStorage } from '../../../../../host/desktop/vault-storage';
import { checkOwnedDirectory, secureOwnedDirectory } from '../../../../../host/desktop/owned-permissions';
import { t } from '../../../../../shared/i18n/index';
import { legacyAccountConfig } from './legacy-accounts';
import { legacyReferences, uniqueLegacyReference } from './legacy-references';

function normalizedName(value: string): string {
	try { return accountName(value); } catch { throw new Error(t('agent.accountInvalid')); }
}

/** A new vault identity starts without credentials inherited from the parent application's shell. */
export const ISOLATED_CREDENTIAL_ENV: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries([
	'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_API_KEY', 'CODEX_API_KEY',
	'GROK_API_KEY', 'XAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'OPENCODE_API_KEY',
].map(key => [key, ''])));

export function accountConfigDir(kind: AgentId | 'claude', accountId: string, accountRoot: string): string {
	const name = normalizedName(accountId);
	const id = name === '' ? 'default' : createHash('sha256').update(name).digest('hex');
	if (!accountRoot) throw new Error(t('agent.accountInvalid'));
	return path.join(accountRoot, 'accounts', kind === 'claude' ? 'claude-code' : kind, id, 'home');
}

/** All provider and fallback homes are account-owned. Never inherit host-global data locations. */
export async function accountEnv(agent: AgentCatalogEntry, accountId: string, vault: string, device: string, interactive = false): Promise<Record<string, string>> {
	const name = normalizedName(accountId), relative = `.nand/agents/${device}`;
	await secureOwnedDirectory(vault, relative);
	const root = await absoluteNandPath(vault, relative), home = accountConfigDir(agent.id, name, root), owner = path.dirname(home);
	const legacy = await legacyAccountConfig(vault, device, agent.id, name, owner, interactive);
	const env: Record<string, string> = {
		HOME: home, USERPROFILE: home,
		APPDATA: path.join(home, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
		TMP: path.join(owner, 'tmp'), TEMP: path.join(owner, 'tmp'), TMPDIR: path.join(owner, 'tmp'),
		XDG_CONFIG_HOME: path.join(owner, 'xdg', 'config'), XDG_CACHE_HOME: path.join(owner, 'xdg', 'cache'),
		XDG_DATA_HOME: path.join(owner, 'xdg', 'data'), XDG_STATE_HOME: path.join(owner, 'xdg', 'state'),
		CLAUDE_CONFIG_DIR: path.join(home, '.claude'), CLAUDE_CODE_TMPDIR: path.join(owner, 'tmp'),
		CODEX_HOME: path.join(home, '.codex'), GROK_HOME: path.join(home, '.grok'), GEMINI_CLI_HOME: home,
		PI_CODING_AGENT_DIR: path.join(home, '.pi', 'agent'), PI_CODING_AGENT_SESSION_DIR: path.join(home, '.pi', 'agent', 'sessions'),
		OPENCODE_CONFIG_DIR: path.join(owner, 'xdg', 'config', 'opencode'),
	};
	if (legacy) env[agent.id === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR'] = legacy;
	const storage = nativeVaultStorage(vault);
	for (const directory of new Set(Object.values(env))) {
		const owned = relative + '/' + path.relative(root, directory).split(path.sep).join('/');
		await storage.mkdir(owned);
	}
	await checkOwnedDirectory(vault, relative + '/' + path.relative(root, owner).split(path.sep).join('/'));
	return { ...env, ...ISOLATED_CREDENTIAL_ENV, NAND_ACCOUNT_NAME: name, NAND_ACCOUNT_ID: agent.id + '/' + path.basename(owner), NAND_ACCOUNT_ROOT: owner };
}

/** A history record identifies an account; it cannot supply arbitrary child-process environment. */
export async function restoredAccountEnv(agent: AgentCatalogEntry, saved: Record<string, string>, vault: string, device: string): Promise<Record<string, string>> {
	return (await restoredAccountReference(agent, saved, vault, device)).env;
}

export async function restoredAccountReference(agent: AgentCatalogEntry, saved: Record<string, string>, vault: string, device: string, transcriptPath?: string): Promise<{ env: Record<string, string>; transcriptPath?: string }> {
	if (!Object.hasOwn(saved, 'NAND_ACCOUNT_ID')) {
		const binding = uniqueLegacyReference(await legacyReferences(vault, device, agent.id), saved);
		if (!binding) throw new Error(t('agent.accountScopeMismatch'));
		const env = await accountEnv(agent, binding.name, vault, device);
		if (transcriptPath) {
			const tail = path.relative(binding.from, transcriptPath);
			if (!tail || tail === '..' || tail.startsWith('..' + path.sep) || path.isAbsolute(tail)) throw new Error(t('agent.sessionMissing'));
			transcriptPath = path.join(binding.to, tail);
		}
		return { env, transcriptPath };
	}
	if (typeof saved.NAND_ACCOUNT_NAME !== 'string' || typeof saved.NAND_ACCOUNT_ID !== 'string') throw new Error(t('agent.accountScopeMismatch'));
	const expected = await accountEnv(agent, saved.NAND_ACCOUNT_NAME, vault, device);
	if (Object.keys(saved).length !== Object.keys(expected).length || Object.entries(expected).some(([key, value]) => saved[key] !== value)) throw new Error(t('agent.accountScopeMismatch'));
	return { env: expected, transcriptPath };
}
/** Resolve host-relative plugin paths once, before selecting native credentials. */
export function absolutePluginDir(vault: string, dir: string): string {
	return path.isAbsolute(dir) ? dir : path.resolve(vault, dir);
}
