// Design adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/main/agent-hooks/installer-utils.ts (shared managed script, wrapPosixHookCommand), hook-config-write-path.ts, hooks-json-read.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { AgentId } from '../../../core/launch/types';
import type { AccountPaths } from '../agents/system-homes';
import { OPENCODE_EXTENSION, PI_EXTENSION } from './native-extensions';
import { stripOwnedRows } from './hook-entries';

/**
 * Status hooks for the system account.
 *
 * One global script set lives in NAND's own directory (`~/.nand/agent-hooks/`) and is shared by every vault. The user's
 * provider configuration receives one fixed, vault-independent command per event; it runs the script only when that
 * file is present and executable, and the script itself does nothing unless the terminal NAND started exports
 * `NAND_HOOK_DIR`/`NAND_HOOK_TOKEN`. Installation is therefore idempotent and never per vault: nothing is removed when a
 * vault closes or the module stops. Entries leave only when the user asks for it, matched by their full command text.
 */

export class SystemHookError extends Error {
	constructor(readonly reason: 'invalidJson' | 'symlink' | 'outsideHome' | 'foreign' | 'unreadable', readonly file: string, detail?: string) {
		super(`${reason}: ${file}${detail ? ' (' + detail + ')' : ''}`);
	}
}

export interface SystemHookEnvironment { home: string; platform: NodeJS.Platform }
export interface SystemHookPaths { directory: string; shell: string; cmd: string; script: string; backups: string; state: string }
export interface SystemHookResult { changed: string[]; skipped: Array<{ file: string; reason: SystemHookError['reason'] }> }

const code = (error: unknown) => (error as NodeJS.ErrnoException).code;
const digest = (text: string) => createHash('sha256').update(text).digest('hex');

export function systemHookPaths(home: string): SystemHookPaths {
	const directory = path.join(home, '.nand', 'agent-hooks');
	return { directory, shell: path.join(directory, 'nand-hook.sh'), cmd: path.join(directory, 'nand-hook.cmd'), script: path.join(directory, 'nand-hook.cjs'), backups: path.join(directory, 'backups'), state: path.join(directory, 'state.json') };
}

export const quotePosix = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

/** The same command for every vault: run the script if it exists, otherwise swallow stdin and succeed. */
export function hookCommand(paths: SystemHookPaths, event: string, platform: NodeJS.Platform): string {
	if (platform === 'win32') return `cmd /d /s /c "if exist "${paths.cmd}" ("${paths.cmd}" ${event}) else (more >nul)"`;
	const script = quotePosix(paths.shell);
	return `if [ -f ${script} ] && [ -r ${script} ] && [ -x ${script} ]; then /bin/sh ${script} ${event}; else { command -p cat 2>/dev/null || cat; } >/dev/null 2>&1 || :; fi`;
}

export const SHELL_SCRIPT = `#!/bin/sh
# NAND status hook, shared by every vault. It does nothing outside a terminal that NAND started.
if [ -n "\${NAND_HOOK_DIR-}" ] && [ -n "\${NAND_HOOK_TOKEN-}" ] && [ -n "\${NAND_HOOK_NODE-}" ] && [ -x "\${NAND_HOOK_NODE}" ] && [ -r "$(dirname "$0")/nand-hook.cjs" ]; then
  ELECTRON_RUN_AS_NODE=1 exec "\${NAND_HOOK_NODE}" "$(dirname "$0")/nand-hook.cjs" "$1"
fi
{ command -p cat 2>/dev/null || cat; } >/dev/null 2>&1 || :
`;
export const CMD_SCRIPT = `@echo off
rem NAND status hook, shared by every vault. It does nothing outside a terminal that NAND started.
if "%NAND_HOOK_DIR%"=="" goto drain
if "%NAND_HOOK_TOKEN%"=="" goto drain
if "%NAND_HOOK_NODE%"=="" goto drain
set ELECTRON_RUN_AS_NODE=1
"%NAND_HOOK_NODE%" "%~dp0nand-hook.cjs" %1
exit /b 0
:drain
more >nul
exit /b 0
`;

/** Provider files and the events NAND listens to. */
export function systemProviders(paths: AccountPaths): Record<Exclude<AgentId, 'pi' | 'opencode'>, { file: string; events: string[]; own?: boolean }> {
	return {
		'claude-code': { file: path.join(paths.CLAUDE_CONFIG_DIR, 'settings.json'), events: ['SessionStart', 'UserPromptSubmit', 'PermissionRequest', 'PreToolUse', 'Stop', 'StopFailure'] },
		codex: { file: path.join(paths.CODEX_HOME, 'hooks.json'), events: ['SessionStart', 'UserPromptSubmit', 'PermissionRequest', 'PreToolUse', 'Stop', 'Interrupt'] },
		gemini: { file: path.join(paths.GEMINI_CLI_HOME, '.gemini', 'settings.json'), events: ['SessionStart', 'BeforeAgent', 'BeforeTool', 'Notification', 'AfterAgent'] },
		grok: { file: path.join(paths.GROK_HOME, 'hooks', 'nand-status.json'), events: ['SessionStart', 'UserPromptSubmit', 'Stop', 'StopFailure', 'StopCancelled'], own: true },
	};
}
export const systemExtensionFile = (agent: 'pi' | 'opencode', paths: AccountPaths) =>
	agent === 'pi' ? path.join(paths.PI_CODING_AGENT_DIR, 'extensions', 'nand-status.ts') : path.join(paths.OPENCODE_CONFIG_DIR, 'plugins', 'nand-status.mjs');

async function readOptional(file: string): Promise<string | undefined> {
	try { return await fs.readFile(file, 'utf8'); } catch (error) { if (code(error) === 'ENOENT') return undefined; throw new SystemHookError('unreadable', file, String(code(error))); }
}

/**
 * Our own directory (`~/.nand/agent-hooks`): created owner-only, and never a link. Every later read, chmod, write or
 * removal of its files first proves that neither `~/.nand` nor the directory is a link and that the directory really lies
 * inside the user's home, so a link planted in place of NAND's directory can never redirect a change.
 */
async function checkOwnLocation(paths: SystemHookPaths, home: string, create: boolean): Promise<boolean> {
	const nand = path.dirname(paths.directory);
	for (const directory of [nand, paths.directory]) {
		let stat;
		try { stat = await fs.lstat(directory); }
		catch (error) {
			if (code(error) !== 'ENOENT') throw new SystemHookError('unreadable', directory, String(code(error)));
			if (!create) return false;
			// Another installer may create it at the same moment; what matters is that it is a real directory.
			try { await fs.mkdir(directory, { mode: 0o700 }); } catch (made) { if (code(made) !== 'EEXIST') throw made; }
			stat = await fs.lstat(directory);
		}
		if (stat.isSymbolicLink()) throw new SystemHookError('symlink', directory);
		if (!stat.isDirectory()) throw new SystemHookError('unreadable', directory, 'not a directory');
	}
	const root = await fs.realpath(home), real = await fs.realpath(paths.directory);
	if (real !== path.join(root, '.nand', 'agent-hooks')) throw new SystemHookError('outsideHome', paths.directory);
	return true;
}

/** One of our files: a regular file only, never a link (even one whose content matches). */
async function checkOwnFile(file: string): Promise<boolean> {
	try {
		const stat = await fs.lstat(file);
		if (stat.isSymbolicLink()) throw new SystemHookError('symlink', file);
		if (!stat.isFile()) throw new SystemHookError('unreadable', file, 'not a file');
		return true;
	} catch (error) { if (error instanceof SystemHookError) throw error; if (code(error) === 'ENOENT') return false; throw new SystemHookError('unreadable', file, String(code(error))); }
}

/** Write one of our files atomically, only when its content changed. */
async function writeOwn(file: string, text: string, mode: number): Promise<boolean> {
	if (await checkOwnFile(file)) {
		if (await readOptional(file) === text) { await fs.chmod(file, mode).catch(() => {}); return false; }
	}
	const temporary = `${file}.tmp-${randomUUID()}`;
	try {
		await fs.writeFile(temporary, text, { mode, flag: 'wx' });
		await fs.rename(temporary, file);
	} finally { await fs.rm(temporary, { force: true }); }
	return true;
}

/** Refuse a link, or anything that resolves outside the user's home; the user's file itself is never followed. */
async function checkUserTarget(file: string, home: string): Promise<void> {
	try { if ((await fs.lstat(file)).isSymbolicLink()) throw new SystemHookError('symlink', file); }
	catch (error) { if (error instanceof SystemHookError) throw error; if (code(error) !== 'ENOENT') throw new SystemHookError('unreadable', file, String(code(error))); }
	// The nearest existing ancestor decides where a new file would land.
	let cursor = path.dirname(path.resolve(file));
	for (;;) {
		try {
			const real = await fs.realpath(cursor), root = await fs.realpath(home), tail = path.relative(root, real);
			if (tail === '..' || tail.startsWith('..' + path.sep) || path.isAbsolute(tail)) throw new SystemHookError('outsideHome', file);
			return;
		} catch (error) {
			if (error instanceof SystemHookError) throw error;
			if (code(error) !== 'ENOENT') throw new SystemHookError('unreadable', file, String(code(error)));
			const parent = path.dirname(cursor);
			if (parent === cursor) throw new SystemHookError('outsideHome', file);
			cursor = parent;
		}
	}
}

/** Keep the last few versions of a user file in NAND's directory, not beside the user's configuration. */
async function backUp(paths: SystemHookPaths, env: SystemHookEnvironment, file: string, raw: string): Promise<void> {
	await checkOwnLocation(paths, env.home, true);
	if (!await fs.lstat(paths.backups).then(stat => stat.isDirectory() && !stat.isSymbolicLink(), () => false)) {
		try { await fs.mkdir(paths.backups, { mode: 0o700 }); } catch (error) { if (code(error) !== 'EEXIST') throw error; }
		if ((await fs.lstat(paths.backups)).isSymbolicLink()) throw new SystemHookError('symlink', paths.backups);
	}
	const label = `${digest(file).slice(0, 8)}-${path.basename(file)}`;
	// Two installers can back up in the same millisecond: the name carries a random suffix and is created exclusively.
	await fs.writeFile(path.join(paths.backups, `${label}.${String(Date.now()).padStart(15, '0')}-${randomUUID().slice(0, 8)}.bak`), raw, { mode: 0o600, flag: 'wx' });
	const mine = (await fs.readdir(paths.backups)).filter(name => name.startsWith(label + '.')).sort();
	for (const old of mine.slice(0, Math.max(0, mine.length - 5))) await fs.rm(path.join(paths.backups, old), { force: true });
}

/**
 * Replace the user's file with `build(current)`, or leave it alone when that returns undefined. The new content goes to
 * a temporary file in the same directory and replaces the file atomically; if the file changed since it was read, the
 * whole step is redone from the new content.
 */
async function updateUserFile(paths: SystemHookPaths, env: SystemHookEnvironment, file: string, build: (raw: string | undefined) => string | undefined | null): Promise<boolean> {
	for (let attempt = 0; attempt < 3; attempt++) {
		await checkUserTarget(file, env.home);
		const raw = await readOptional(file), next = build(raw);
		if (next === undefined || next === raw) return false;
		if (next === null) { if (raw === undefined) return false; }
		if (raw !== undefined) await backUp(paths, env, file, raw);
		const directory = path.dirname(file);
		if (next !== null) await fs.mkdir(directory, { recursive: true, mode: 0o700 });
		await checkUserTarget(file, env.home);
		if (await readOptional(file) !== raw) continue;
		if (next === null) { await fs.unlink(file); return true; }
		const temporary = path.join(directory, `.${path.basename(file)}.nand-tmp-${randomUUID()}`);
		try {
			let mode = 0o600;
			try { mode = (await fs.stat(file)).mode & 0o777; } catch { /* a new file */ }
			await fs.writeFile(temporary, next, { mode, flag: 'wx' });
			if (await readOptional(file) !== raw) continue;
			await fs.rename(temporary, file);
			return true;
		} finally { await fs.rm(temporary, { force: true }); }
	}
	throw new SystemHookError('unreadable', file, 'changed while updating');
}

function parseSettings(file: string, raw: string | undefined): Record<string, unknown> {
	// Only a file that is not there is new; an empty or blank one is damaged JSON and is left alone.
	if (raw === undefined) return {};
	try {
		const parsed: unknown = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
	} catch { /* reported below */ }
	throw new SystemHookError('invalidJson', file);
}

function containsCommand(rows: unknown[], command: string): boolean {
	return rows.some(row => !!row && typeof row === 'object' && ((row as { command?: unknown }).command === command
		|| Array.isArray((row as { hooks?: unknown }).hooks) && ((row as { hooks: unknown[] }).hooks).some(entry => !!entry && typeof entry === 'object' && (entry as { command?: unknown }).command === command)));
}

/** Add our command to each event unless the exact command is already there; nothing else is touched. */
export function addHookEntries(settings: Record<string, unknown>, file: string, events: string[], command: (event: string) => string): Record<string, unknown> | undefined {
	if (settings.hooks !== undefined && (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks))) throw new SystemHookError('invalidJson', file, 'hooks');
	const hooks = { ...(settings.hooks as Record<string, unknown> | undefined) };
	let changed = false;
	for (const event of events) {
		const rows: unknown = hooks[event] ?? [];
		if (!Array.isArray(rows)) throw new SystemHookError('invalidJson', file, event);
		const existing: unknown[] = rows;
		if (containsCommand(existing, command(event))) continue;
		hooks[event] = [...existing, { hooks: [{ type: 'command', command: command(event), timeout: events.includes('BeforeAgent') ? 5000 : 5 }] }];
		changed = true;
	}
	if (!changed) return undefined;
	const next: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(settings)) next[key] = key === 'hooks' ? hooks : value;
	if (settings.hooks === undefined) next.hooks = hooks;
	return next;
}

/** Remove exactly our commands; the group, its other commands and its fields stay. */
export function removeHookEntries(settings: Record<string, unknown>, ours: ReadonlySet<string>): Record<string, unknown> | undefined {
	if (!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks)) return undefined;
	const hooks = { ...(settings.hooks as Record<string, unknown>) };
	let removed = 0;
	for (const [event, rows] of Object.entries(hooks)) {
		if (!Array.isArray(rows)) continue;
		const result = stripOwnedRows(rows, command => ours.has(command));
		if (!result.removed) continue;
		removed += result.removed;
		if (result.rows.length) hooks[event] = result.rows; else delete hooks[event];
	}
	if (!removed) return undefined;
	const next: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(settings)) {
		if (key !== 'hooks') next[key] = value; else if (Object.keys(hooks).length) next.hooks = hooks;
	}
	return next;
}

const serialize = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

/** Digests of the extension files NAND wrote, so an unmodified older copy can still be upgraded. */
async function readState(paths: SystemHookPaths, env: SystemHookEnvironment): Promise<Record<string, string>> {
	if (!await checkOwnLocation(paths, env.home, false) || !await checkOwnFile(paths.state)) return {};
	try {
		const value: unknown = JSON.parse(await fs.readFile(paths.state, 'utf8'));
		return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, string> : {};
	} catch { return {}; }
}
async function remember(paths: SystemHookPaths, env: SystemHookEnvironment, file: string, text: string | null): Promise<void> {
	if (!await checkOwnLocation(paths, env.home, text !== null)) return;
	const state = await readState(paths, env);
	if (text === null) delete state[file]; else state[file] = digest(text);
	await writeOwn(paths.state, serialize(state), 0o600);
}

export async function installSystemScripts(env: SystemHookEnvironment, script: string): Promise<SystemHookPaths> {
	const paths = systemHookPaths(env.home);
	await checkOwnLocation(paths, env.home, true);
	await writeOwn(paths.script, script, 0o644);
	if (env.platform === 'win32') await writeOwn(paths.cmd, CMD_SCRIPT, 0o644); else await writeOwn(paths.shell, SHELL_SCRIPT, 0o755);
	return paths;
}

/**
 * Make the global scripts current and make sure the provider's configuration carries our entries. Idempotent: a vault
 * that finds everything in place writes nothing. A problem with one file is reported, never forced.
 */
export async function installSystemHooks(agent: AgentId, accountPaths: AccountPaths, env: SystemHookEnvironment, script: string): Promise<SystemHookResult> {
	const result: SystemHookResult = { changed: [], skipped: [] };
	let paths: SystemHookPaths;
	try { paths = await installSystemScripts(env, script); }
	catch (error) {
		// Unsafe script location: nothing is written anywhere, so no entry can point at it.
		if (error instanceof SystemHookError) return { changed: [], skipped: [{ file: error.file, reason: error.reason }] };
		throw error;
	}
	const attempt = async (file: string, run: () => Promise<boolean>) => {
		try { if (await run()) result.changed.push(file); }
		catch (error) { if (error instanceof SystemHookError) result.skipped.push({ file, reason: error.reason }); else throw error; }
	};
	if (agent === 'pi' || agent === 'opencode') {
		const file = systemExtensionFile(agent, accountPaths), template = agent === 'pi' ? PI_EXTENSION : OPENCODE_EXTENSION;
		await attempt(file, async () => {
			const known = (await readState(paths, env))[file];
			const changed = await updateUserFile(paths, env, file, raw => {
				if (raw === undefined) return template;
				if (raw === template) return undefined;
				// Only a copy NAND itself wrote, still unmodified, may be replaced by a newer version.
				if (known && digest(raw) === known) return template;
				throw new SystemHookError('foreign', file);
			});
			await remember(paths, env, file, template);
			return changed;
		});
		return result;
	}
	const provider = systemProviders(accountPaths)[agent];
	await attempt(provider.file, () => updateUserFile(paths, env, provider.file, raw => {
		const settings = parseSettings(provider.file, raw), next = addHookEntries(settings, provider.file, provider.events, event => hookCommand(paths, event, env.platform));
		return next ? serialize(next) : undefined;
	}));
	return result;
}

/** What the user's "remove system status hooks" does: exactly our commands and our own untouched extension files. */
export async function removeSystemHooks(accountPaths: AccountPaths, env: SystemHookEnvironment): Promise<SystemHookResult> {
	const paths = systemHookPaths(env.home), result: SystemHookResult = { changed: [], skipped: [] };
	const attempt = async (file: string, run: () => Promise<boolean>) => {
		try { if (await run()) result.changed.push(file); }
		catch (error) { if (error instanceof SystemHookError) result.skipped.push({ file, reason: error.reason }); else throw error; }
	};
	for (const provider of Object.values(systemProviders(accountPaths))) {
		const ours = new Set((['linux', 'win32'] as const).flatMap(platform => provider.events.map(event => hookCommand(paths, event, platform))));
		await attempt(provider.file, async () => {
			if (await readOptional(provider.file) === undefined) return false;
			return updateUserFile(paths, env, provider.file, raw => {
				if (raw === undefined) return undefined;
				const next = removeHookEntries(parseSettings(provider.file, raw), ours);
				if (!next) return undefined;
				return provider.own && !Object.keys(next).length ? null : serialize(next);
			});
		});
	}
	for (const agent of ['pi', 'opencode'] as const) {
		const file = systemExtensionFile(agent, accountPaths), template = agent === 'pi' ? PI_EXTENSION : OPENCODE_EXTENSION;
		await attempt(file, async () => {
			const raw = await readOptional(file);
			if (raw === undefined) return false;
			const known = (await readState(paths, env))[file];
			if (raw !== template && !(known && digest(raw) === known)) throw new SystemHookError('foreign', file);
			const changed = await updateUserFile(paths, env, file, current => current === raw ? null : undefined);
			await remember(paths, env, file, null);
			return changed;
		});
	}
	return result;
}

/** The scripts are ours alone; they go once the user removed the entries. Links and anything outside NAND's directory are left. */
export async function removeSystemScripts(env: SystemHookEnvironment): Promise<SystemHookResult> {
	const paths = systemHookPaths(env.home), result: SystemHookResult = { changed: [], skipped: [] };
	try {
		if (!await checkOwnLocation(paths, env.home, false)) return result;
		for (const file of [paths.shell, paths.cmd, paths.script, paths.state]) {
			if (await checkOwnFile(file)) { await fs.rm(file); result.changed.push(file); }
		}
	} catch (error) {
		if (error instanceof SystemHookError) result.skipped.push({ file: error.file, reason: error.reason }); else throw error;
	}
	return result;
}
