/**
 * Local version probe for AI launcher CLIs.
 *
 * Runs `<tool> --version` and extracts the first MAJOR.MINOR.PATCH(-suffix)?
 * token from its output.
 *
 * Why direct invocation:
 *   - Maximum accuracy. Every launcher's `--version` is the upstream's own
 *     answer for "what version is installed?" — no guessing about install
 *     layouts or manifest field names. Native installers (Anthropic's
 *     standalone Claude binary, OpenCode's scoop / single-binary), npm
 *     packages, and Homebrew casks all surface the same answer through
 *     `--version`, so one code path covers every install method.
 *   - Minimal system intrusion. We do not walk `~/.claude`, `~/.opencode`,
 *     `%APPDATA%\npm`, or any other user-data directory looking for a
 *     manifest. The probe only invokes the CLI the user already
 *     authorized us to launch via the preset workflow, with a fixed
 *     `--version` argument; it cannot pick up secrets or read files
 *     outside the launcher itself.
 *
 * Platform invocation:
 *   - Windows: `cmd.exe /C "<tool> --version"` so PATHEXT does the
 *     `.cmd` / `.exe` resolution. `windowsHide: true` keeps the console
 *     window hidden when Obsidian is running detached.
 *   - POSIX: spawn the binary directly with `--version`. We do NOT
 *     route through the user's interactive shell — Obsidian on macOS
 *     can lose `~/.zshrc` PATH overrides when launched from the GUI,
 *     and a hung rc file would block the menu render. If a user's
 *     binary is missing from PATH, the launcher row shows "Not
 *     installed" and the install modal explains how to fix the PATH.
 */

import { debugWarn } from '../logger';

export interface CommandVersionResult {
	/** Extracted MAJOR.MINOR.PATCH(-suffix)? token, or null when not found. */
	version: string | null;
	/**
	 * Absolute path of the binary that satisfied the probe, when known.
	 * Currently always null because we let `cmd.exe` / PATH do resolution
	 * internally; kept on the result shape so callers and the snapshot
	 * builder stay source-compatible with the historical fallback-scan
	 * implementation.
	 */
	resolvedFrom: string | null;
	/** Trimmed `--version` output. Useful for diagnostics in the modal. */
	rawOutput: string | null;
}

interface CacheEntry {
	result: CommandVersionResult;
	expiresAt: number;
}

/**
 * 60s cache keeps repeated menu opens from re-spawning the CLI every time.
 * Users hit "refresh" in the install modal to invalidate eagerly when they
 * know they just upgraded.
 */
const CACHE_TTL_MS = 60_000;
/**
 * 3s timeout. We are blocking the menu render path, so we cap
 * aggressively. Every supported CLI replies within ~200ms in practice;
 * if one hangs we'd rather show the badge with no version than freeze
 * the popup.
 */
const PROBE_TIMEOUT_MS = 3_000;
const VERSION_REGEX = /\d+\.\d+\.\d+(-[\w.]+)?/;

const cache = new Map<string, CacheEntry>();

interface ChildProcessLike {
	stdout?: { on(event: 'data', listener: (chunk: Buffer | string) => void): void };
	stderr?: { on(event: 'data', listener: (chunk: Buffer | string) => void): void };
	on(event: 'error', listener: (error: Error) => void): void;
	on(event: 'exit', listener: (code: number | null) => void): void;
	kill(): void;
}

interface NodeChildProcess {
	spawn: (command: string, args: string[], options: Record<string, unknown>) => ChildProcessLike;
}

/**
 * Probe `<command> --version` and return the extracted version string.
 *
 * Caches results for {@link CACHE_TTL_MS} so a status bar menu can be
 * re-rendered without re-spawning the CLI. The cache key is the raw
 * command string, which is exactly what callers pass in (and what the
 * catalog stores in `detectCommand`).
 */
export async function probeCommandVersion(command: string): Promise<CommandVersionResult> {
	const trimmed = command.trim();
	if (!trimmed) {
		return { version: null, resolvedFrom: null, rawOutput: null };
	}

	const cached = cache.get(trimmed);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.result;
	}

	const result = await runProbe(trimmed);
	cache.set(trimmed, { result, expiresAt: Date.now() + CACHE_TTL_MS });
	return result;
}

/**
 * Drop cached probe results. Exposed for explicit refresh actions
 * (e.g. the user just installed the CLI and wants to retry without
 * waiting for the cache TTL to expire).
 */
export function clearCommandVersionCache(command?: string): void {
	if (command) {
		cache.delete(command.trim());
	} else {
		cache.clear();
	}
}

/**
 * Extract the first MAJOR.MINOR.PATCH(-suffix)? token from a string.
 * Returned for tests and any caller that wants to reuse our regex.
 */
export function extractVersionString(raw: string): string | null {
	const match = VERSION_REGEX.exec(raw);
	return match ? match[0] : null;
}

function loadChildProcess(): NodeChildProcess | null {
	try {
		return window.require('child_process') as NodeChildProcess;
	} catch (error) {
		debugWarn('[commandVersionProbe] child_process unavailable:', error);
		return null;
	}
}

function runProbe(command: string): Promise<CommandVersionResult> {
	return new Promise((resolve) => {
		const childProcess = loadChildProcess();
		if (!childProcess) {
			resolve({ version: null, resolvedFrom: null, rawOutput: null });
			return;
		}

		let proc: ChildProcessLike;
		try {
			// Windows: route through cmd.exe so PATHEXT resolves `.cmd` / `.exe`.
			// POSIX: spawn the binary directly — the kernel performs PATH resolution
			// and we do not want to inherit a flaky interactive shell.
			if (process.platform === 'win32') {
				proc = childProcess.spawn('cmd.exe', ['/C', `${command} --version`], {
					windowsHide: true,
				});
			} else {
				proc = childProcess.spawn(command, ['--version'], {
					windowsHide: true,
				});
			}
		} catch (error) {
			debugWarn(`[commandVersionProbe] spawn failed for ${command}:`, error);
			resolve({ version: null, resolvedFrom: null, rawOutput: null });
			return;
		}

		let stdout = '';
		let stderr = '';
		proc.stdout?.on('data', (chunk) => {
			stdout += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
		});
		proc.stderr?.on('data', (chunk) => {
			stderr += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
		});

		let settled = false;
		const finish = (result: CommandVersionResult) => {
			if (settled) return;
			settled = true;
			resolve(result);
		};

		const timer = window.setTimeout(() => {
			try {
				proc.kill();
			} catch (error) {
				debugWarn('[commandVersionProbe] failed to kill probe process:', error);
			}
			finish({ version: null, resolvedFrom: null, rawOutput: null });
		}, PROBE_TIMEOUT_MS);

		proc.on('error', () => {
			window.clearTimeout(timer);
			finish({ version: null, resolvedFrom: null, rawOutput: null });
		});

		proc.on('exit', () => {
			window.clearTimeout(timer);
			// Prefer stdout, fall back to stderr — some CLIs emit `--version`
			// on stderr (e.g. older Codex builds).
			const merged = (stdout || stderr).trim();
			const version = merged ? extractVersionString(merged) : null;
			finish({
				version,
				resolvedFrom: null,
				rawOutput: merged || null,
			});
		});
	});
}
