import path from 'node:path';
import { mkdtemp, mkdir, readdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { afterEach, expect, test, vi } from 'vitest';
import { AGENT_CATALOG, getAgent } from '../../../core/launch/catalog';
import { LEGACY_VAULT_ACCOUNT, accountEnv, managedAccountEnv } from './accounts';
import { inLegacyDefaultAccount, legacyDefaultAccountsToAdopt, markLegacyDefaultAdopted } from './legacy-default';
import { checkAccountTranscript } from './transcript';

afterEach(() => vi.unstubAllEnvs());
const homes = ['CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'GROK_HOME', 'GEMINI_CLI_HOME', 'PI_CODING_AGENT_DIR', 'PI_CODING_AGENT_SESSION_DIR', 'XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'OPENCODE_CONFIG_DIR'];
async function fixture() {
	const root = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-system-account-'))), vault = path.join(root, 'vault'), home = path.join(root, 'home');
	await mkdir(vault); await mkdir(home);
	vi.stubEnv('HOME', home); vi.stubEnv('USERPROFILE', home); for (const key of homes) vi.stubEnv(key, '');
	return { root, vault, home };
}

test('a former default account that holds a login or history is adopted once as a named managed account, with nothing moved', async () => {
	const { root, vault } = await fixture();
	try {
		const codex = getAgent('codex'), claude = getAgent('claude-code');
		// An empty default directory (created by every old launch) is not worth a list entry.
		await managedAccountEnv(claude, '', vault, 'fixture-device');
		const used = await managedAccountEnv(codex, '', vault, 'fixture-device');
		await writeFile(path.join(used.CODEX_HOME!, 'auth.json'), '{"token":"fixture"}');
		const sessions = await managedAccountEnv(getAgent('grok'), '', vault, 'fixture-device');
		await mkdir(path.join(sessions.GROK_HOME!, 'sessions', 'one'), { recursive: true });
		expect(await legacyDefaultAccountsToAdopt(vault, 'fixture-device')).toEqual(['codex', 'grok']);
		// Adoption selects the same directory under the reserved name and leaves its files in place.
		const adopted = await accountEnv(codex, LEGACY_VAULT_ACCOUNT, vault, 'fixture-device');
		expect(adopted.CODEX_HOME).toBe(used.CODEX_HOME);
		expect(await readFile(path.join(adopted.CODEX_HOME!, 'auth.json'), 'utf8')).toBe('{"token":"fixture"}');
		await markLegacyDefaultAdopted(vault, 'fixture-device');
		expect(await legacyDefaultAccountsToAdopt(vault, 'fixture-device')).toEqual([]);
		expect(await inLegacyDefaultAccount(vault, 'fixture-device', 'codex', path.join(used.CODEX_HOME!, 'sessions', 'a.jsonl'))).toBe(true);
		expect(await inLegacyDefaultAccount(vault, 'fixture-device', 'codex', path.join(root, 'elsewhere.jsonl'))).toBe(false);
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);

test('only a provider session log is a readable system transcript; login and settings files are refused', async () => {
	const { root, vault, home } = await fixture();
	try {
		const layout: Record<string, { ok: string[]; bad: string[] }> = {
			codex: { ok: ['.codex/sessions/2026/one.jsonl'], bad: ['.codex/auth.json', '.codex/history.jsonl', '.codex/config.toml', '.codex/sessions/2026/notes.txt', '.codex/hooks.json'] },
			'claude-code': { ok: ['.claude/projects/p/one.jsonl'], bad: ['.claude/.credentials.json', '.claude/settings.json', '.claude/history.jsonl', '.claude/projects/p/meta.json'] },
			gemini: { ok: ['.gemini/tmp/p/chats/s.json', '.gemini/tmp/p/chats/s.jsonl'], bad: ['.gemini/oauth_creds.json', '.gemini/settings.json', '.gemini/tmp/p/other.json', '.gemini/tmp/p/chats/readme.txt'] },
			grok: { ok: ['.grok/sessions/x/session.json'], bad: ['.grok/auth.json', '.grok/sessions/x/chat_history.jsonl', '.grok/config.json'] },
			pi: { ok: ['.pi/agent/sessions/a.jsonl'], bad: ['.pi/agent/auth.json', '.pi/agent/settings.json'] },
			opencode: { ok: ['.local/share/opencode/opencode.db'], bad: ['.local/share/opencode/auth.json', '.local/share/opencode/opencode.db-wal'] },
		};
		for (const [id, files] of Object.entries(layout)) {
			const agent = AGENT_CATALOG.find(row => row.id === id)!, env = await accountEnv(agent, '', vault, 'fixture-device');
			for (const file of [...files.ok, ...files.bad]) { await mkdir(path.dirname(path.join(home, file)), { recursive: true }); await writeFile(path.join(home, file), '{}'); }
			for (const file of files.ok) await expect(checkAccountTranscript(vault, env, path.join(home, file)), id + ' ' + file).resolves.toBeUndefined();
			for (const file of files.bad) await expect(checkAccountTranscript(vault, env, path.join(home, file)), id + ' ' + file).rejects.toThrow();
			await expect(checkAccountTranscript(vault, env, path.join(root, 'outside.jsonl'))).rejects.toThrow();
		}
		// Links inside the history directory are still refused.
		const codex = AGENT_CATALOG.find(row => row.id === 'codex')!, env = await accountEnv(codex, '', vault, 'fixture-device');
		await symlink(path.join(home, '.codex', 'auth.json'), path.join(home, '.codex/sessions/2026/link.jsonl'));
		await expect(checkAccountTranscript(vault, env, path.join(home, '.codex/sessions/2026/link.jsonl'))).rejects.toThrow();
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);

