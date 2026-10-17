import path from 'node:path';
import { realpath, mkdtemp, mkdir, symlink, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { LEGACY_VAULT_ACCOUNT, accountConfigDir, accountEnv, managedAccountEnv, resolveAccountEnv, restoredAccountReference } from './accounts';
import { accountPaths, isSystemAccount, systemAccountPaths } from './system-homes';
import { accountArgs } from './account-args';
import { AGENT_CATALOG } from '../../../core/launch/catalog';

test('Chinese, punctuation and case-sensitive account names retain distinct portable identities', () => {
	const root = path.resolve('fixture-plugin');
	const names = ['中文', '中文！', 'a.b', 'ab', 'A', 'a', '', 'default'];
	const directories = names.map(name => accountConfigDir('claude', name, root));
	expect(directories.every(value => typeof value === 'string' && value.length > root.length)).toBe(true);
	expect(new Set(directories).size).toBe(names.length);
	expect(accountConfigDir('claude', 'e\u0301', root)).toBe(accountConfigDir('claude', 'é', root));
	for (const name of [' ', '\t', 'abc\u0000', 'a\nb', 'a\u200Bb', 'a'.repeat(129)])
		expect(() => accountConfigDir('claude', name, root)).toThrow();
});

test('every provider and managed account uses the opened vault for homes, cache and temporary data', async () => {
	const vault = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-agent-env-')));
	try {
		for (const agent of AGENT_CATALOG) for (const name of [LEGACY_VAULT_ACCOUNT, '测试.!']) {
			const env = await accountEnv(agent, name, vault, 'fixture-device');
			for (const key of ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TMP', 'TEMP', 'TMPDIR', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'GROK_HOME', 'GEMINI_CLI_HOME', 'PI_CODING_AGENT_DIR', 'PI_CODING_AGENT_SESSION_DIR', 'OPENCODE_CONFIG_DIR']) {
				expect(env[key], agent.id + ':' + key).toBeTruthy();
				expect(path.relative(vault, env[key]!).split(path.sep).slice(0, 4)).toEqual(['.nand', 'agents', 'fixture-device', 'accounts']);
				expect((await stat(env[key]!)).isDirectory()).toBe(true);
			}
			expect(env.NAND_ACCOUNT_NAME).toBe(name);
		}
	} finally { await rm(vault, { recursive: true, force: true }); }
}, 30000);

test('a junction arriving after permission repair cannot be handed to a child process', async () => {
	const root = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-agent-link-'))), vault = path.join(root, 'vault'), outside = path.join(root, 'outside');
	await mkdir(vault); await mkdir(outside);
	try {
		const agent = AGENT_CATALOG.find(row => row.id === 'codex')!;
		const env = await accountEnv(agent, 'a.b', vault, 'fixture-device');
		await symlink(outside, path.join(env.CODEX_HOME!, 'sessions'), 'junction');
		await expect(accountEnv(agent, 'a.b', vault, 'fixture-device')).rejects.toThrow('private-storage.symlink');
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);

test('managed accounts cannot silently inherit host-global provider tokens or credential files', async () => {
	const vault = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-agent-credentials-')));
	try {
		const env = await accountEnv(AGENT_CATALOG[0]!, '测试.!', vault, 'fixture-device');
		for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_API_KEY', 'CODEX_API_KEY', 'GROK_API_KEY', 'XAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'OPENCODE_API_KEY']) expect(env[key]).toBe('');
	} finally { await rm(vault, { recursive: true, force: true }); }
}, 30000);

test('the system account overrides no home or credential variable and names the real provider homes', async () => {
	const vault = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-agent-system-')));
	try {
		for (const agent of AGENT_CATALOG) {
			const env = await accountEnv(agent, '', vault, 'fixture-device');
			expect(Object.keys(env).sort()).toEqual(['NAND_ACCOUNT_ID', 'NAND_ACCOUNT_NAME', 'NAND_ACCOUNT_ROOT']);
			expect(env.NAND_ACCOUNT_NAME).toBe('');
			expect(env.NAND_ACCOUNT_ID).toBe(agent.id + '/system');
			expect(isSystemAccount(env)).toBe(true);
			expect(path.relative(vault, env.NAND_ACCOUNT_ROOT!).split(path.sep)).toEqual(['.nand', 'agents', 'fixture-device', 'system']);
			expect(accountArgs(agent.id, ['--flag'], env)).toEqual(['--flag']);
			// A recorded system session resolves to the same environment.
			expect((await restoredAccountReference(agent, env, vault, 'fixture-device')).env).toEqual(env);
			expect(await resolveAccountEnv(agent, env, vault, 'fixture-device')).toEqual(env);
		}
	} finally { await rm(vault, { recursive: true, force: true }); }
}, 30000);

test('real provider homes follow exported variables and otherwise the user home', () => {
	const home = path.resolve('fixture-home');
	const fallback = systemAccountPaths({}, home);
	expect(fallback).toMatchObject({ CLAUDE_CONFIG_DIR: path.join(home, '.claude'), CODEX_HOME: path.join(home, '.codex'), GROK_HOME: path.join(home, '.grok'), GEMINI_CLI_HOME: home, PI_CODING_AGENT_DIR: path.join(home, '.pi', 'agent'), XDG_DATA_HOME: path.join(home, '.local', 'share') });
	expect(fallback.PI_CODING_AGENT_SESSION_DIR).toBe(path.join(home, '.pi', 'agent', 'sessions'));
	expect(fallback.OPENCODE_CONFIG_DIR).toBe(path.join(home, '.config', 'opencode'));
	const exported = path.resolve('exported');
	const custom = systemAccountPaths({ CLAUDE_CONFIG_DIR: path.join(exported, 'claude'), CODEX_HOME: path.join(exported, 'codex'), XDG_CONFIG_HOME: path.join(exported, 'cfg'), CODEX_HOME_UNRELATED: 'x' }, home);
	expect(custom.CLAUDE_CONFIG_DIR).toBe(path.join(exported, 'claude'));
	expect(custom.CODEX_HOME).toBe(path.join(exported, 'codex'));
	expect(custom.OPENCODE_CONFIG_DIR).toBe(path.join(exported, 'cfg', 'opencode'));
	// A relative value is not a location.
	expect(systemAccountPaths({ CODEX_HOME: 'relative' }, home).CODEX_HOME).toBe(path.join(home, '.codex'));
	expect(accountPaths({ NAND_ACCOUNT_ID: 'codex/system' }).CODEX_HOME).toBe(systemAccountPaths().CODEX_HOME);
});

test('the former default directory stays reachable as a named managed account and for sessions saved before the change', async () => {
	const vault = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-agent-legacy-default-')));
	try {
		const agent = AGENT_CATALOG.find(row => row.id === 'codex')!;
		const legacy = await accountEnv(agent, LEGACY_VAULT_ACCOUNT, vault, 'fixture-device');
		const old = await managedAccountEnv(agent, '', vault, 'fixture-device');
		expect(legacy.CODEX_HOME).toBe(old.CODEX_HOME);
		expect(path.basename(legacy.NAND_ACCOUNT_ROOT!)).toBe('default');
		expect(legacy.NAND_ACCOUNT_NAME).toBe(LEGACY_VAULT_ACCOUNT);
		expect(old.NAND_ACCOUNT_NAME).toBe('');
		expect(isSystemAccount(old)).toBe(false);
		expect((await restoredAccountReference(agent, old, vault, 'fixture-device')).env).toEqual(old);
		expect((await restoredAccountReference(agent, legacy, vault, 'fixture-device')).env).toEqual(legacy);
		expect(accountArgs('codex', [], legacy).some(arg => arg.includes('cli_auth_credentials_store'))).toBe(true);
	} finally { await rm(vault, { recursive: true, force: true }); }
}, 30000);
