import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chmod, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { afterEach, expect, test, vi } from 'vitest';
import { AGENT_CATALOG } from '../../../core/launch/catalog';
import { accountEnv } from '../agents/accounts';
import { systemAccountPaths } from '../agents/system-homes';
import { AutomationHooks, HOOK_SCRIPT } from './automation-hooks';
import { PI_EXTENSION } from './native-extensions';
import { hookCommand, installSystemHooks, installSystemScripts, removeSystemHooks, removeSystemScripts, systemHookPaths, systemProviders } from './system-hooks';

// Every test runs against a throwaway home; the real provider files are never involved.
const race = vi.hoisted(() => ({ beforeRename: undefined as (() => Promise<void>) | undefined }));
vi.mock('node:fs/promises', async original => {
	const actual = await original<typeof import('node:fs/promises')>();
	return { ...actual, rename: async (...args: Parameters<typeof actual.rename>) => { const hook = race.beforeRename; race.beforeRename = undefined; if (hook) await hook(); return actual.rename(...args); } };
});
afterEach(() => { race.beforeRename = undefined; vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function fixture() {
	const root = await realpath(await mkdtemp(path.join(tmpdir(), "nand-system-hooks-it's-")));
	const home = path.join(root, 'home dir'); await mkdir(home);
	for (const key of ['HOME', 'USERPROFILE']) vi.stubEnv(key, home);
	for (const key of ['CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'GROK_HOME', 'GEMINI_CLI_HOME', 'PI_CODING_AGENT_DIR', 'PI_CODING_AGENT_SESSION_DIR', 'OPENCODE_CONFIG_DIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME']) vi.stubEnv(key, '');
	const win = { require: createRequire(import.meta.url), setInterval: () => 1, clearInterval: () => {} } as unknown as Window;
	vi.stubGlobal('window', win);
	return { root, home, win, paths: systemAccountPaths({}, home), env: { home, platform: 'linux' as const } };
}
const agent = (id: string) => AGENT_CATALOG.find(row => row.id === id)!;
const exists = (file: string) => lstat(file).then(() => true, () => false);

test('one fixed command per event is added to the real config; groups, user commands and key order survive; reinstalling writes nothing', async () => {
	const { root, home, paths, env } = await fixture();
	try {
		const file = systemProviders(paths)['claude-code'].file; await mkdir(path.dirname(file), { recursive: true });
		const userCommand = { type: 'command', command: 'echo USER_HOOK' };
		const original = { model: 'keep', hooks: { Stop: [{ matcher: 'Bash', hooks: [userCommand] }] }, tail: 1 };
		await writeFile(file, JSON.stringify(original), { mode: 0o640 });
		const originalMode = (await stat(file)).mode & 0o777;
		const first = await installSystemHooks('claude-code', paths, env, HOOK_SCRIPT);
		expect(first.changed).toEqual([file]);
		const text = await readFile(file, 'utf8'), merged = JSON.parse(text) as { hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ command: string }> }>> };
		const stop = hookCommand(systemHookPaths(home), 'Stop', 'linux');
		expect(Object.keys(JSON.parse(text))).toEqual(['model', 'hooks', 'tail']);
		expect(merged.hooks.Stop![0]).toEqual({ matcher: 'Bash', hooks: [userCommand] });
		expect(merged.hooks.Stop![1]!.hooks[0]!.command).toBe(stop);
		expect(Object.keys(merged.hooks).sort()).toEqual(['PermissionRequest', 'PreToolUse', 'SessionStart', 'Stop', 'StopFailure', 'UserPromptSubmit']);
		expect((await stat(file)).mode & 0o777).toBe(originalMode);
		// The command is the same for every vault and names no vault path or executable.
		expect(stop).not.toContain('.nand/agents');
		const before = (await stat(file)).mtimeMs;
		expect((await installSystemHooks('claude-code', paths, env, HOOK_SCRIPT)).changed).toEqual([]);
		expect(await readFile(file, 'utf8')).toBe(text);
		expect((await stat(file)).mtimeMs).toBe(before);
		// Nothing but the config itself sits in the user's directory; the one backup is in NAND's directory.
		expect(await readdir(path.dirname(file))).toEqual(['settings.json']);
		const backups = await readdir(systemHookPaths(home).backups);
		expect(backups).toHaveLength(1);
		expect(JSON.parse(await readFile(path.join(systemHookPaths(home).backups, backups[0]!), 'utf8'))).toEqual(original);
		// Scripts live in NAND's directory, executable, and are refreshed when their content changes.
		const shell = systemHookPaths(home).shell;
		if (process.platform !== 'win32') expect((await stat(shell)).mode & 0o111).not.toBe(0);
		expect(await readFile(systemHookPaths(home).script, 'utf8')).toBe(HOOK_SCRIPT);
		await installSystemHooks('claude-code', paths, env, HOOK_SCRIPT + '// newer\n');
		expect(await readFile(systemHookPaths(home).script, 'utf8')).toBe(HOOK_SCRIPT + '// newer\n');
		expect((await readdir(systemHookPaths(home).directory)).filter(name => name.includes('.tmp-'))).toEqual([]);
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);

test('two vaults install byte-identical entries, and closing a vault or stopping hooks removes nothing', async () => {
	const { root, home, win, paths } = await fixture();
	try {
		const vaults = ['a', 'b'].map(name => path.join(root, name)); for (const vault of vaults) await mkdir(vault);
		const file = systemProviders(paths).codex.file; await mkdir(path.dirname(file), { recursive: true });
		const texts: string[] = [];
		for (const vault of vaults) {
			const hooks = new AutomationHooks(win, () => ({ vault, device: 'device' }));
			const handle = await hooks.prepare('codex', await accountEnv(agent('codex'), '', vault, 'device'), () => {});
			expect(handle.env.NAND_HOOK_NODE).toBe(process.execPath);
			texts.push(await readFile(file, 'utf8'));
			handle.close(); hooks.dispose();
		}
		expect(texts[0]).toBe(texts[1]);
		expect(texts[0]).not.toContain(root);
		expect(JSON.parse(await readFile(file, 'utf8')).hooks.Stop).toHaveLength(1);
		expect(await exists(systemHookPaths(home)[process.platform === 'win32' ? 'cmd' : 'shell'])).toBe(true);
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);

test('removal takes exactly NAND commands: same-group user commands and look-alike commands stay', async () => {
	const { root, home, paths, env } = await fixture();
	try {
		const file = systemProviders(paths).codex.file; await mkdir(path.dirname(file), { recursive: true });
		const ours = hookCommand(systemHookPaths(home), 'Stop', 'linux');
		const user = { type: 'command', command: 'echo USER' }, lookalike = { type: 'command', command: `echo 'see ${systemHookPaths(home).shell}' >> /tmp/note.log` };
		await writeFile(file, JSON.stringify({ keep: true, hooks: { Stop: [{ matcher: 'x', extra: 1, hooks: [user, { type: 'command', command: ours }, lookalike] }, { hooks: [{ type: 'command', command: ours }] }], Other: [{ hooks: [user] }] } }));
		const result = await removeSystemHooks(paths, env);
		expect(result.changed).toEqual([file]);
		expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ keep: true, hooks: { Stop: [{ matcher: 'x', extra: 1, hooks: [user, lookalike] }], Other: [{ hooks: [user] }] } });
		// Nothing left to remove: no write at all.
		const before = (await stat(file)).mtimeMs;
		expect((await removeSystemHooks(paths, env)).changed).toEqual([]);
		expect((await stat(file)).mtimeMs).toBe(before);
		await installSystemHooks('codex', paths, env, HOOK_SCRIPT);
		await removeSystemScripts(env);
		expect(await exists(systemHookPaths(home).shell)).toBe(false);
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);

test('a link, an invalid file, or a target outside the home is refused and reported, never written', async () => {
	const { root, home, paths, env } = await fixture();
	try {
		const outside = path.join(root, 'outside'); await mkdir(outside);
		// A dotfile-style link at the file.
		const claude = systemProviders(paths)['claude-code'].file; await mkdir(path.dirname(claude), { recursive: true });
		await writeFile(path.join(outside, 'dot.json'), '{"dot":true}'); await symlink(path.join(outside, 'dot.json'), claude);
		let result = await installSystemHooks('claude-code', paths, env, HOOK_SCRIPT);
		expect(result).toMatchObject({ changed: [], skipped: [{ file: claude, reason: 'symlink' }] });
		expect(await readFile(path.join(outside, 'dot.json'), 'utf8')).toBe('{"dot":true}');
		expect((await lstat(claude)).isSymbolicLink()).toBe(true);
		// Invalid JSON.
		const codex = systemProviders(paths).codex.file; await mkdir(path.dirname(codex), { recursive: true });
		await writeFile(codex, '{ not json');
		result = await installSystemHooks('codex', paths, env, HOOK_SCRIPT);
		expect(result.skipped).toEqual([{ file: codex, reason: 'invalidJson' }]);
		expect(await readFile(codex, 'utf8')).toBe('{ not json');
		await writeFile(codex, '[]');
		expect((await installSystemHooks('codex', paths, env, HOOK_SCRIPT)).skipped[0]?.reason).toBe('invalidJson');
		// A directory that resolves outside the home (the provider directory is a link to somewhere else).
		const gemini = systemProviders(paths).gemini.file;
		await symlink(outside, path.join(home, '.gemini'));
		result = await installSystemHooks('gemini', paths, env, HOOK_SCRIPT);
		expect(result.skipped).toEqual([{ file: gemini, reason: 'outsideHome' }]);
		expect(await readdir(outside)).toEqual(['dot.json']);
		// A removal obeys the same rules.
		expect((await removeSystemHooks(paths, env)).skipped.map(row => row.reason)).not.toContain('outsideHome');
		expect(await readFile(path.join(outside, 'dot.json'), 'utf8')).toBe('{"dot":true}');
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);

test('a file that changed between reading and replacing is merged on a retry, not overwritten', async () => {
	const { root, paths, env } = await fixture();
	try {
		const file = systemProviders(paths)['claude-code'].file; await mkdir(path.dirname(file), { recursive: true });
		await writeFile(file, '{"a":1}');
		let injected = 0;
		race.beforeRename = async () => { injected++; await writeFile(file, '{"a":1,"userAdded":true}'); };
		await installSystemHooks('claude-code', paths, env, HOOK_SCRIPT);
		expect(injected).toBe(1);
		const final = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
		expect(final.userAdded).toBe(true);
		expect(JSON.stringify(final.hooks)).toContain('nand-hook.sh');
		// Concurrent installs of the same agent converge on one entry per event.
		await Promise.all([installSystemHooks('claude-code', paths, env, HOOK_SCRIPT), installSystemHooks('claude-code', paths, env, HOOK_SCRIPT)]);
		expect((JSON.parse(await readFile(file, 'utf8')) as { hooks: { Stop: unknown[] } }).hooks.Stop).toHaveLength(1);
		expect((await readdir(path.dirname(file))).filter(name => name !== 'settings.json')).toEqual([]);
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);

test('pi and OpenCode extensions: NAND owns one fixed file; a user file or modified copy is kept and reported; an unmodified older NAND copy is upgraded', async () => {
	const { root, home, paths, env } = await fixture();
	try {
		for (const [id, file] of [['pi', path.join(paths.PI_CODING_AGENT_DIR, 'extensions', 'nand-status.ts')], ['opencode', path.join(paths.OPENCODE_CONFIG_DIR, 'plugins', 'nand-status.mjs')]] as const) {
			await mkdir(path.dirname(file), { recursive: true });
			await writeFile(file, '// USER CUSTOM CONTENT');
			let result = await installSystemHooks(id, paths, env, HOOK_SCRIPT);
			expect(result.skipped).toEqual([{ file, reason: 'foreign' }]);
			expect(await readFile(file, 'utf8')).toBe('// USER CUSTOM CONTENT');
			expect((await removeSystemHooks(paths, env)).skipped).toContainEqual({ file, reason: 'foreign' });
			expect(await readFile(file, 'utf8')).toBe('// USER CUSTOM CONTENT');
			await rm(file);
			result = await installSystemHooks(id, paths, env, HOOK_SCRIPT);
			expect(result.changed).toEqual([file]);
			const written = await readFile(file, 'utf8');
			expect((await installSystemHooks(id, paths, env, HOOK_SCRIPT)).changed).toEqual([]);
			// The user edits NAND's copy: it is theirs now, whether installing or removing.
			await writeFile(file, written + '\n// edited by the user');
			expect((await installSystemHooks(id, paths, env, HOOK_SCRIPT)).skipped).toEqual([{ file, reason: 'foreign' }]);
			expect((await removeSystemHooks(paths, env)).skipped).toContainEqual({ file, reason: 'foreign' });
			expect(await readFile(file, 'utf8')).toBe(written + '\n// edited by the user');
			// An unmodified copy that NAND wrote (known by its digest) is upgraded and removable.
			await writeFile(file, written);
			expect((await removeSystemHooks(paths, env)).changed).toContain(file);
			expect(await exists(file)).toBe(false);
		}
		expect(PI_EXTENSION).toContain('NAND_HOOK_DIR');
		expect(await exists(path.join(home, '.pi', 'agent', 'extensions', 'nand-status.ts'))).toBe(false);
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);

test.skipIf(process.platform === 'win32')('the config command is inert without a NAND terminal, swallows stdin when the script is missing, and forwards events when it is not', async () => {
	const { root, home, paths, env } = await fixture();
	try {
		const command = (event: string) => hookCommand(systemHookPaths(home), event, 'linux');
		const run = (event: string, input: string, environment: Record<string, string>) => spawnSync('/bin/sh', ['-c', command(event)], { input, env: { PATH: process.env.PATH ?? '', ...environment }, encoding: 'utf8' });
		// Script missing (the home path holds a space and a quote): success, no output, stdin drained.
		let result = run('Stop', '{"session_id":"s"}', {});
		expect(result).toMatchObject({ status: 0, stdout: '', stderr: '' });
		await installSystemHooks('codex', paths, env, HOOK_SCRIPT);
		// Script present but not in a NAND terminal.
		result = run('Stop', '{"session_id":"s"}', {});
		expect(result).toMatchObject({ status: 0, stdout: '', stderr: '' });
		// A NAND terminal: the event reaches that vault's spool.
		const account = path.join(root, 'vault', 'account'), directory = path.join(account, 'runtime', 'hooks', 'terminal-x');
		await mkdir(directory, { recursive: true });
		result = run('Stop', '{"session_id":"abc","last_assistant_message":"done"}', { NAND_HOOK_DIR: directory, NAND_HOOK_TOKEN: 'token-1', NAND_HOOK_NODE: process.execPath, NAND_ACCOUNT_ROOT: account });
		expect(result.status).toBe(0);
		const events = (await readdir(directory)).filter(name => name.endsWith('.json'));
		expect(events).toHaveLength(1);
		expect(JSON.parse(await readFile(path.join(directory, events[0]!), 'utf8'))).toMatchObject({ token: 'token-1', event: 'Stop' });
		// Missing runtime path in the environment: still inert.
		result = run('Stop', '{}', { NAND_HOOK_DIR: directory, NAND_HOOK_TOKEN: 'token-1', NAND_HOOK_NODE: '/nonexistent/runtime', NAND_ACCOUNT_ROOT: account });
		expect(result).toMatchObject({ status: 0, stdout: '' });
		await chmod(systemHookPaths(home).shell, 0o644);
		expect(run('Stop', '{}', { NAND_HOOK_DIR: directory, NAND_HOOK_TOKEN: 'token-1', NAND_HOOK_NODE: process.execPath, NAND_ACCOUNT_ROOT: account })).toMatchObject({ status: 0, stdout: '' });
		expect((await readdir(directory)).filter(name => name.endsWith('.json'))).toHaveLength(1);
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);

test('NAND\'s own directory is never trusted through a link: install, removal and chmod stay inside ~/.nand/agent-hooks', async () => {
	const { root, home, paths, env } = await fixture();
	try {
		const outside = path.join(root, 'outside'); await mkdir(path.join(outside, 'agent-hooks'), { recursive: true });
		const kept = path.join(outside, 'agent-hooks', 'nand-hook.cjs');
		await writeFile(kept, 'KEEP USER FILE');
		// `~/.nand` is a link to a directory outside the home.
		await symlink(outside, path.join(home, '.nand'));
		const codex = systemProviders(paths).codex.file; await mkdir(path.dirname(codex), { recursive: true });
		let result = await installSystemHooks('codex', paths, env, HOOK_SCRIPT);
		expect(result.changed).toEqual([]);
		expect(result.skipped[0]?.reason).toBe('symlink');
		expect(await exists(codex)).toBe(false);
		expect(await readdir(path.join(outside, 'agent-hooks'))).toEqual(['nand-hook.cjs']);
		// Removal runs exactly as the controller does: hooks first, then scripts. Nothing outside the home is deleted.
		await removeSystemHooks(paths, env);
		result = await removeSystemScripts(env);
		expect(result.changed).toEqual([]);
		expect(result.skipped[0]?.reason).toBe('symlink');
		expect(await readFile(kept, 'utf8')).toBe('KEEP USER FILE');
		await rm(path.join(home, '.nand'));
		// The agent-hooks directory itself is a link.
		await mkdir(path.join(home, '.nand'));
		await symlink(path.join(outside, 'agent-hooks'), path.join(home, '.nand', 'agent-hooks'));
		expect((await removeSystemScripts(env)).skipped[0]?.reason).toBe('symlink');
		expect(await readFile(kept, 'utf8')).toBe('KEEP USER FILE');
		await rm(path.join(home, '.nand'), { recursive: true });
		// A script leaf that is a link to a same-content file outside: its mode is not changed and it is not replaced or removed.
		await mkdir(path.join(home, '.nand', 'agent-hooks'), { recursive: true });
		const external = path.join(outside, 'external.sh');
		await writeFile(external, (await import('./system-hooks')).SHELL_SCRIPT, { mode: 0o600 });
		const originalMode = (await stat(external)).mode & 0o777;
		await symlink(external, systemHookPaths(home).shell);
		result = await installSystemHooks('codex', paths, env, HOOK_SCRIPT);
		expect(result.skipped[0]).toMatchObject({ reason: 'symlink' });
		expect((await stat(external)).mode & 0o777).toBe(originalMode);
		expect(await exists(codex)).toBe(false);
		await writeFile(systemHookPaths(home).script, 'x');
		result = await removeSystemScripts(env);
		expect(result.skipped[0]).toMatchObject({ reason: 'symlink' });
		expect((await lstat(systemHookPaths(home).shell)).isSymbolicLink()).toBe(true);
		expect(await readFile(external, 'utf8')).toContain('NAND status hook');
		// Removal when nothing was ever installed creates nothing.
		await rm(path.join(home, '.nand'), { recursive: true });
		expect(await removeSystemScripts(env)).toEqual({ changed: [], skipped: [] });
		expect(await exists(path.join(home, '.nand'))).toBe(false);
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);

test.each(['EPERM', 'EACCES', 'EBUSY'])('a temporary %s during replacement rereads the user config before retrying', async (code) => {
	const { root, paths, env } = await fixture();
	try {
		await installSystemScripts(env, HOOK_SCRIPT);
		const file = systemProviders(paths).codex.file;
		await mkdir(path.dirname(file), { recursive: true });
		await writeFile(file, '{"user":"KEEP"}');
		race.beforeRename = async () => {
			await writeFile(file, '{"user":"KEEP","addedWhileBusy":true}');
			throw Object.assign(new Error('destination busy'), { code });
		};
		expect((await installSystemHooks('codex', paths, env, HOOK_SCRIPT)).changed).toEqual([file]);
		expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ user: 'KEEP', addedWhileBusy: true, hooks: { Stop: expect.any(Array) } });
		expect(await readdir(path.dirname(file))).toEqual(['hooks.json']);
	} finally { await rm(root, { recursive: true, force: true }); }
});

test('shared scripts recover from a temporary replacement lock without leaving temporary files', async () => {
	const { root, home, paths, env } = await fixture();
	try {
		race.beforeRename = async () => { throw Object.assign(new Error('destination busy'), { code: 'EPERM' }); };
		await installSystemHooks('codex', paths, env, HOOK_SCRIPT);
		expect(await readFile(systemHookPaths(home).script, 'utf8')).toBe(HOOK_SCRIPT);
		expect((await readdir(systemHookPaths(home).directory)).filter(name => name.includes('.tmp-'))).toEqual([]);
	} finally { await rm(root, { recursive: true, force: true }); }
});

test.each([['EPERM', 3], ['EIO', 1]] as const)('a persistent %s leaves the original config intact and stops after %s attempts', async (code, expectedAttempts) => {
	const { root, paths, env } = await fixture();
	try {
		await installSystemScripts(env, HOOK_SCRIPT);
		const file = systemProviders(paths).codex.file;
		await mkdir(path.dirname(file), { recursive: true });
		await writeFile(file, '{"user":"KEEP"}');
		let attempts = 0;
		const fail = async () => {
			attempts++;
			race.beforeRename = fail;
			throw Object.assign(new Error('replacement failed'), { code });
		};
		race.beforeRename = fail;
		await expect(installSystemHooks('codex', paths, env, HOOK_SCRIPT)).rejects.toMatchObject({ code });
		expect(attempts).toBe(expectedAttempts);
		expect(await readFile(file, 'utf8')).toBe('{"user":"KEEP"}');
		expect(await readdir(path.dirname(file))).toEqual(['hooks.json']);
	} finally { await rm(root, { recursive: true, force: true }); }
});

test('two installers backing up in the same moment both succeed, and each user config is kept', async () => {
	for (let round = 0; round < 12; round++) {
		const { root, paths, env } = await fixture();
		try {
			const file = systemProviders(paths).codex.file; await mkdir(path.dirname(file), { recursive: true });
			await writeFile(file, '{"user":"KEEP"}');
			const results = await Promise.allSettled([installSystemHooks('codex', paths, env, HOOK_SCRIPT), installSystemHooks('codex', paths, env, HOOK_SCRIPT)]);
			expect(results.map(row => row.status === 'rejected' ? String(row.reason) : row.status)).toEqual(['fulfilled', 'fulfilled']);
			const final = JSON.parse(await readFile(file, 'utf8')) as { user: string; hooks: Record<string, unknown[]> };
			expect(final.user).toBe('KEEP');
			expect(Object.values(final.hooks).every(rows => rows.length === 1)).toBe(true);
			const backups = await readdir(path.join(path.dirname(path.dirname(path.dirname(systemHookPaths(env.home).state))), '.nand', 'agent-hooks', 'backups'));
			expect(backups.length).toBeGreaterThanOrEqual(1);
			expect(new Set(backups).size).toBe(backups.length);
		} finally { await rm(root, { recursive: true, force: true }); vi.unstubAllEnvs(); }
	}
}, 60000);

test('an existing empty or blank JSON file is damaged, not new: it is reported and left as it is', async () => {
	const { root, paths, env } = await fixture();
	try {
		const file = systemProviders(paths).codex.file; await mkdir(path.dirname(file), { recursive: true });
		for (const content of ['', '   \n\t ', '﻿']) {
			await writeFile(file, content);
			expect(await installSystemHooks('codex', paths, env, HOOK_SCRIPT)).toMatchObject({ changed: [], skipped: [{ file, reason: 'invalidJson' }] });
			expect(await readFile(file, 'utf8')).toBe(content);
			expect((await removeSystemHooks(paths, env)).skipped).toContainEqual({ file, reason: 'invalidJson' });
			expect(await readFile(file, 'utf8')).toBe(content);
		}
		// A file that is not there is still created.
		await rm(file);
		expect((await installSystemHooks('codex', paths, env, HOOK_SCRIPT)).changed).toEqual([file]);
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);
