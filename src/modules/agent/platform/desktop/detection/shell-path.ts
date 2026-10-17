// Login-shell probe adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/main/startup/login-shell-environment.ts
import { execFile } from 'node:child_process';

const START = '__NAND_LOGIN_SHELL_ENV_START__', END = '__NAND_LOGIN_SHELL_ENV_END__';

/** Only variables that decide where an agent CLI looks for its existing login or how it reaches the network. */
export const LOGIN_SHELL_KEYS: readonly string[] = [
	'PATH',
	'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'GROK_HOME', 'GEMINI_CLI_HOME', 'PI_CODING_AGENT_DIR', 'PI_CODING_AGENT_SESSION_DIR', 'OPENCODE_CONFIG_DIR',
	'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME',
	'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'CODEX_API_KEY',
	'GROK_API_KEY', 'XAI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'OPENCODE_API_KEY',
	'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy',
];

export function parseLoginShellEnvironment(output: Buffer | string): Record<string, string> | null {
	const buffer = typeof output === 'string' ? Buffer.from(output) : output;
	const open = Buffer.from(`\0${START}\0`), close = Buffer.from(`\0${END}\0`);
	const start = buffer.indexOf(open);
	if (start < 0) return null;
	const end = buffer.indexOf(close, start + open.length);
	if (end < 0) return null;
	const result: Record<string, string> = {};
	for (const entry of buffer.subarray(start + open.length, end).toString('utf8').split('\0')) {
		const separator = entry.indexOf('=');
		if (separator > 0) result[entry.slice(0, separator)] = entry.slice(separator + 1);
	}
	return Object.keys(result).length ? result : null;
}

function probe(shell: string, timeoutMs: number): Promise<Record<string, string> | null> {
	return new Promise(resolve => {
		const command = `printf '\\0${START}\\0'; /usr/bin/env -0; printf '\\0${END}\\0'`;
		try {
			const child = execFile(shell, ['-ilc', command], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, encoding: 'buffer', killSignal: 'SIGKILL' }, (error, stdout) => {
				resolve(error && !stdout?.length ? null : parseLoginShellEnvironment(stdout));
			});
			child.stdin?.end();
		} catch { resolve(null); }
	});
}

let cached: Promise<Record<string, string>> | undefined;
let resolved: Record<string, string> = {};

/** Variables a login shell exports that this process lacks, as when Obsidian starts from a desktop icon. Cached; Windows skips the probe. */
export function loginShellEnvironment(timeoutMs = 10_000, force = false): Promise<Record<string, string>> {
	if (process.platform === 'win32') return Promise.resolve({});
	if (force) cached = undefined;
	cached ??= (async () => {
		const shell = process.env.SHELL || '/bin/bash';
		const environment = await probe(shell, timeoutMs);
		const extra: Record<string, string> = {};
		if (environment) for (const key of LOGIN_SHELL_KEYS) {
			const value = environment[key];
			// PATH is what a desktop icon lacks; every other variable only fills a gap, so an explicitly exported value stays.
			if (value && (key === 'PATH' ? value !== process.env.PATH : !process.env[key])) extra[key] = value;
		}
		resolved = extra;
		return extra;
	})();
	return cached;
}

/** Synchronous view of the last finished probe; empty until it completes. */
export function recoveredLoginEnvironment(): Readonly<Record<string, string>> {
	return resolved;
}

export function resetLoginShellEnvironmentForTests(): void {
	cached = undefined;
	resolved = {};
}

export async function loginShellPath(timeoutMs = 5000, force = false): Promise<string | null> {
	if (process.platform === 'win32') return process.env.PATH ?? null;
	return (await loginShellEnvironment(timeoutMs, force)).PATH ?? process.env.PATH ?? null;
}
