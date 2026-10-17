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
import { SYSTEM_ACCOUNT_SUFFIX, isSystemAccount } from './system-homes';

/**
 * Name of the managed account that adopts the vault's former default account. Its directory is the old `default`
 * one, so credentials and history stay where they were. The empty name now means the system account.
 */
export const LEGACY_VAULT_ACCOUNT = 'vault-account-legacy';

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
	const id = name === '' || name === LEGACY_VAULT_ACCOUNT ? 'default' : createHash('sha256').update(name).digest('hex');
	if (!accountRoot) throw new Error(t('agent.accountInvalid'));
	return path.join(accountRoot, 'accounts', kind === 'claude' ? 'claude-code' : kind, id, 'home');
}

/**
 * The empty name is the system account: the CLI runs with the user's real HOME and provider homes, keeps any API key
 * already exported, and only NAND's own markers are added. A named account is managed: every provider and fallback
 * home is owned by that account and never inherits host-global data locations.
 */
export async function accountEnv(agent: AgentCatalogEntry, accountId: string, vault: string, device: string, interactive = false): Promise<Record<string, string>> {
	const name = normalizedName(accountId);
	return name === '' ? systemAccountEnv(agent, vault, device) : managedAccountEnv(agent, name, vault, device, interactive);
}

/** Runtime state of the system account lives in the vault; credentials and provider data never do. */
export async function systemAccountEnv(agent: AgentCatalogEntry, vault: string, device: string): Promise<Record<string, string>> {
	const relative = `.nand/agents/${device}`;
	await secureOwnedDirectory(vault, relative);
	const owner = path.join(await absoluteNandPath(vault, relative), 'system');
	await nativeVaultStorage(vault).mkdir(relative + '/system');
	await checkOwnedDirectory(vault, relative + '/system');
	return { NAND_ACCOUNT_NAME: '', NAND_ACCOUNT_ID: agent.id + SYSTEM_ACCOUNT_SUFFIX, NAND_ACCOUNT_ROOT: owner };
}

export function managedHomes(home: string, owner: string): Record<string, string> {
	return {
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
}

/** A managed account; the empty name selects the vault's former default directory, which only old sessions still name. */
export async function managedAccountEnv(agent: AgentCatalogEntry, accountId: string, vault: string, device: string, interactive = false): Promise<Record<string, string>> {
	const name = normalizedName(accountId), relative = `.nand/agents/${device}`;
	await secureOwnedDirectory(vault, relative);
	const root = await absoluteNandPath(vault, relative), home = accountConfigDir(agent.id, name, root), owner = path.dirname(home);
	const legacy = await legacyAccountConfig(vault, device, agent.id, name === LEGACY_VAULT_ACCOUNT ? '' : name, owner, interactive);
	const env = managedHomes(home, owner);
	if (legacy) env[agent.id === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR'] = legacy;
	const storage = nativeVaultStorage(vault);
	for (const directory of new Set(Object.values(env))) {
		const owned = relative + '/' + path.relative(root, directory).split(path.sep).join('/');
		await storage.mkdir(owned);
	}
	await checkOwnedDirectory(vault, relative + '/' + path.relative(root, owner).split(path.sep).join('/'));
	return { ...env, ...ISOLATED_CREDENTIAL_ENV, NAND_ACCOUNT_NAME: name, NAND_ACCOUNT_ID: agent.id + '/' + path.basename(owner), NAND_ACCOUNT_ROOT: owner };
}

/** The environment a recorded session was started with: the system account, the former default directory, or a named account. */
export async function resolveAccountEnv(agent: AgentCatalogEntry, saved: Record<string, string>, vault: string, device: string): Promise<Record<string, string>> {
	if (typeof saved.NAND_ACCOUNT_NAME !== 'string' || typeof saved.NAND_ACCOUNT_ID !== 'string') throw new Error(t('agent.accountScopeMismatch'));
	if (isSystemAccount(saved)) return systemAccountEnv(agent, vault, device);
	return managedAccountEnv(agent, saved.NAND_ACCOUNT_NAME, vault, device);
}

/** History keys for the former default directory stay what they were, so sessions indexed before the change keep their identity. */
export async function historyAccountEnv(agent: AgentCatalogEntry, env: Record<string, string>, vault: string, device: string): Promise<Record<string, string>> {
	return env.NAND_ACCOUNT_NAME === LEGACY_VAULT_ACCOUNT ? managedAccountEnv(agent, '', vault, device) : env;
}

/** A history record identifies an account; it cannot supply arbitrary child-process environment. */
export async function restoredAccountEnv(agent: AgentCatalogEntry, saved: Record<string, string>, vault: string, device: string): Promise<Record<string, string>> {
	return (await restoredAccountReference(agent, saved, vault, device)).env;
}

export async function restoredAccountReference(agent: AgentCatalogEntry, saved: Record<string, string>, vault: string, device: string, transcriptPath?: string): Promise<{ env: Record<string, string>; transcriptPath?: string }> {
	if (!Object.hasOwn(saved, 'NAND_ACCOUNT_ID')) {
		const binding = uniqueLegacyReference(await legacyReferences(vault, device, agent.id), saved);
		if (!binding) throw new Error(t('agent.accountScopeMismatch'));
		const env = await managedAccountEnv(agent, binding.name, vault, device);
		if (transcriptPath) {
			const tail = path.relative(binding.from, transcriptPath);
			if (!tail || tail === '..' || tail.startsWith('..' + path.sep) || path.isAbsolute(tail)) throw new Error(t('agent.sessionMissing'));
			transcriptPath = path.join(binding.to, tail);
		}
		return { env, transcriptPath };
	}
	if (typeof saved.NAND_ACCOUNT_NAME !== 'string' || typeof saved.NAND_ACCOUNT_ID !== 'string') throw new Error(t('agent.accountScopeMismatch'));
	const expected = await resolveAccountEnv(agent, saved, vault, device);
	if (Object.keys(saved).length !== Object.keys(expected).length || Object.entries(expected).some(([key, value]) => saved[key] !== value)) throw new Error(t('agent.accountScopeMismatch'));
	return { env: expected, transcriptPath };
}
/** Resolve host-relative plugin paths once, before selecting native credentials. */
export function absolutePluginDir(vault: string, dir: string): string {
	return path.isAbsolute(dir) ? dir : path.resolve(vault, dir);
}
