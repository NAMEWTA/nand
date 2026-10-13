import path from 'node:path';
import { realpath, mkdtemp, mkdir, symlink, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { accountConfigDir, accountEnv } from './accounts';
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

test('every provider including its default identity uses the opened vault for homes, cache and temporary data', async () => {
	const vault = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-agent-env-')));
	try {
		for (const agent of AGENT_CATALOG) for (const name of ['', '测试.!']) {
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
		const env = await accountEnv(agent, '', vault, 'fixture-device');
		await symlink(outside, path.join(env.CODEX_HOME!, 'sessions'), 'junction');
		await expect(accountEnv(agent, '', vault, 'fixture-device')).rejects.toThrow('private-storage.symlink');
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);

test('vault accounts cannot silently inherit host-global provider tokens or credential files', async () => {
	const vault = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-agent-credentials-')));
	try {
		const env = await accountEnv(AGENT_CATALOG[0]!, '', vault, 'fixture-device');
		for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_API_KEY', 'CODEX_API_KEY', 'GROK_API_KEY', 'XAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'OPENCODE_API_KEY']) expect(env[key]).toBe('');
	} finally { await rm(vault, { recursive: true, force: true }); }
}, 30000);
