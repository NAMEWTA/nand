import { expect, test, vi } from 'vitest';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { precheckEnvironment } from './precheck-environment';
import { windowsPrecheckCommand } from './precheck-windows';
import { createPrecheckRunner } from './precheck';
const directories = [
	'HOME',
	'USERPROFILE',
	'XDG_CONFIG_HOME',
	'XDG_CACHE_HOME',
	'XDG_DATA_HOME',
	'XDG_STATE_HOME',
	'XDG_RUNTIME_DIR',
	'APPDATA',
	'LOCALAPPDATA',
	'TMPDIR',
	'TMP',
	'TEMP',
	'CLAUDE_CONFIG_DIR',
	'CLAUDE_CODE_TMPDIR',
	'CODEX_HOME',
	'GEMINI_CLI_HOME',
	'GROK_HOME',
	'PI_CODING_AGENT_DIR',
	'PI_CODING_AGENT_SESSION_DIR',
	'OPENCODE_CONFIG_DIR',
];
test('Windows mapping is wholly owned, retains executable lookup and drops unknown host/credential variables', () => {
	const home = 'C:\\vault\\.nand\\automation\\device\\precheck-home';
	const env = precheckEnvironment(
		home,
		{
			Path: 'C:\\Windows',
			SystemRoot: 'C:\\Windows',
			APPDATA: 'C:\\Users\\me',
			XDG_STATE_HOME: '/host',
			AWS_CONFIG_FILE: '/host/config',
			NODE_OPTIONS: '--require /host/script',
			ANTHROPIC_API_KEY: 'fixture',
		},
		true,
	);
	for (const key of directories) expect(env[key]).toMatch(/^C:\\vault\\\.nand\\automation\\device\\precheck-home/);
	expect(env).toMatchObject({
		Path: 'C:\\Windows',
		SystemRoot: 'C:\\Windows',
		HOMEDRIVE: 'C:',
		HOMEPATH: '\\vault\\.nand\\automation\\device\\precheck-home',
	});
	for (const key of ['AWS_CONFIG_FILE', 'NODE_OPTIONS', 'ANTHROPIC_API_KEY']) expect(env[key]).toBeUndefined();
});
test.skipIf(process.platform === 'win32')(
	'a real shell writes all data/config/state paths only inside .nand',
	async () => {
		const vault = await mkdtemp(path.join(tmpdir(), 'nand-precheck-env-'));
		const host = await mkdtemp(path.join(tmpdir(), 'nand-host-env-'));
		for (const key of directories) vi.stubEnv(key, host);
		vi.stubEnv('FOREIGN_STATE_DIR', host);
		try {
			const command =
				directories.map((key) => `printf isolated > "$${key}/probe-${key}"`).join('; ') +
				'; test -z "$FOREIGN_STATE_DIR"';
			const result = await createPrecheckRunner(vault, 'device', {
				setTimeout,
				clearTimeout,
			} as unknown as Window)({
				precheck: { shell: 'bash', command },
				cwd: '.',
				signal: new AbortController().signal,
				timeoutMs: 2000,
			});
			expect(result.exitCode).toBe(0);
			const home = path.join(vault, '.nand/automation/device/precheck-home');
			const env = precheckEnvironment(home, {}, false);
			for (const key of directories)
				expect(await readFile(path.join(env[key]!, `probe-${key}`), 'utf8')).toBe('isolated');
			expect(await readdir(vault)).toEqual(['.nand']);
			expect(await readdir(host)).toEqual([]);
		} finally {
			vi.unstubAllEnvs();
			await rm(vault, { recursive: true, force: true });
			await rm(host, { recursive: true, force: true });
		}
	},
);
test('Windows supervisor assigns suspended command to kill-on-close job before resuming it', () => {
	const args = windowsPrecheckCommand('bash', ['-c', 'echo "quoted"'], 'C:\\vault');
	const script = Buffer.from(args.at(-1)!, 'base64').toString('utf16le');
	expect(args[3]).toBe('-EncodedCommand');
	expect(script).toContain('0x08000004');
	expect(script).toContain('limits.basic.flags=0x2000');
	expect(script.indexOf('if(!AssignProcessToJobObject')).toBeLessThan(script.indexOf('if(ResumeThread'));
	expect(script).toContain('CloseHandle(job)');
});
