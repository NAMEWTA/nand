import { Notice, Platform } from 'obsidian';
import { AutomationError } from '../../../../../shared/automation/errors';
import type { AgentId } from '../../../core/launch/types';
import { OPENCODE_EXTENSION, PI_EXTENSION } from './native-extensions';
import { EVENT_PAYLOAD_SCRIPT, MAX_HOOK_INPUT_BYTES } from './event-payload';
import { getAgent } from '../../../core/launch/catalog';
import { resolveAccountEnv } from '../agents/accounts';
import { accountPaths, isSystemAccount } from '../agents/system-homes';
import { installSystemHooks, type SystemHookResult } from './system-hooks';
import { stripOwnedRows } from './hook-entries';
import { privatePathHasSymlink } from '../../../../../host/desktop/private-mode';
import { t } from '../../../../../shared/i18n/index';
import { SPOOL_GUARD } from './spool-guard';
import { writeHookSettings } from './settings-write';

const installations = new Map<string, Promise<void>>();

async function checkOwnedPath(file: string): Promise<void> {
	if (await privatePathHasSymlink(file)) throw new Error('private-storage.symlink');
}

async function nodeModules() {
	if (!Platform.isDesktop) throw new AutomationError('agentUnavailable');
	return Promise.resolve([
		window.require('node:fs/promises') as typeof import('node:fs/promises'),
		window.require('node:os') as typeof import('node:os'),
		window.require('node:path') as typeof import('node:path'),
		window.require('node:process') as typeof import('node:process'),
	] as const);
}
export interface NativeHookEvent {
	event: string;
	at: number;
	data: Record<string, unknown>;
}
const SCRIPT_NAME = 'nand-automation-hook.cjs';
// Generated for this account; it has no effect without this terminal's event token.
export const HOOK_SCRIPT = `const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = process.env.NAND_HOOK_DIR, token = process.env.NAND_HOOK_TOKEN;
if (!dir || !token) process.exit(0);
${EVENT_PAYLOAD_SCRIPT}
${SPOOL_GUARD}
function post(event, data) {
 try {
 checkSpool();
 const name = process.hrtime.bigint().toString().padStart(24, '0') + '-' + crypto.randomUUID();
 const file = path.join(dir, name);
 fs.writeFileSync(file + '.pending', JSON.stringify({ token, event, at: Date.now(), data }), { mode: 0o600 });
 fs.renameSync(file + '.pending', file + '.json');
 } catch {}
}
let input = '', bytes = 0, oversized = false; process.stdin.setEncoding('utf8');
const timeout = setTimeout(() => { post('HookError', { nand_answer_error: 'hookInputTimeout' }); process.exit(0); }, 3000);
process.stdin.on('data', data => {
 bytes += Buffer.byteLength(data, 'utf8');
 if (bytes > ${MAX_HOOK_INPUT_BYTES}) { oversized = true; input = ''; }
 else if (!oversized) input += data;
});
process.stdin.on('end', () => {
 try {
  if (oversized) post('HookError', { nand_answer_error: 'hookInputTooLarge' });
  else post(process.argv[2], eventData(JSON.parse(input || '{}')));
 } catch { post('HookError', { nand_answer_error: 'hookInputInvalid' }); }
 clearTimeout(timeout);
 // Codex Stop expects a JSON response. This supplies no approval or continuation decision.
 process.stdout.write('{}');
});
`;
function quote(value: string): string {
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}
function command(script: string, event: string, runtime: { platform: string; execPath: string }): string {
	return runtime.platform === 'win32'
		? `set "ELECTRON_RUN_AS_NODE=1" && "${runtime.execPath}" "${script}" ${event}`
		: `ELECTRON_RUN_AS_NODE=1 ${quote(runtime.execPath)} ${quote(script)} ${event}`;
}
export function mergeNativeHooks(
	value: unknown,
	script: string,
	events: string[],
	runtime = { platform: 'linux', execPath: 'node' },
	/** Replace only entries of this script; a real provider file can carry entries of other vaults. */
	own?: string,
): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AutomationError('hookSettingsInvalid');
	const settings = value as Record<string, unknown>;
	if (
		settings.hooks !== undefined &&
		(!settings.hooks || typeof settings.hooks !== 'object' || Array.isArray(settings.hooks))
	)
		throw new AutomationError('hookSettingsInvalid');
	const hooks = { ...(settings.hooks as Record<string, unknown> | undefined) };
	for (const event of events) {
		const previous = hooks[event] ?? [];
		if (!Array.isArray(previous)) throw new AutomationError('hookSettingsInvalid');
		// Only our own command entries are replaced; a group shared with user commands keeps them.
		const { rows } = stripOwnedRows(previous as unknown[], (entry) => entry.includes(own ?? SCRIPT_NAME));
		hooks[event] = [
			...rows,
			{
				hooks: [
					{
						type: 'command',
						command: command(script, event, runtime),
						timeout: events.includes('BeforeAgent') ? 5000 : 5,
					},
				],
			},
		];
	}
	return { ...settings, hooks };
}

/** Per-terminal event spool. Native events, never output silence, finish a turn. */
export class AutomationHooks {
	private disposed = false;
	private timer?: number;
	private reading = false;
	private slots = new Map<string, { dir: string; token: string; receive: (event: NativeHookEvent) => void }>();
	/** `strict`: a system configuration NAND cannot update is an error (automations need the events); otherwise it is a notice. */
	constructor(private win: Window, private scope: () => { vault: string; device: string }, private options: { strict?: boolean } = {}) {}
	async prepare(
		agent: AgentId,
		env: Record<string, string>,
		receive: (event: NativeHookEvent) => void,
	): Promise<{ env: Record<string, string>; close(): void }> {
		if (this.disposed) throw new AutomationError('agentUnavailable');
		const [fs, , path, nodeProcess] = await nodeModules();
		const scope = this.scope();
		const owned = await resolveAccountEnv(getAgent(agent), env, scope.vault, scope.device);
		if (Object.entries(owned).some(([key, value]) => env[key] !== value)) throw new Error(t('agent.accountScopeMismatch'));
		const token = crypto.randomUUID();
		const parent = path.join(owned.NAND_ACCOUNT_ROOT!, 'runtime', 'hooks');
		await checkOwnedPath(parent); await fs.mkdir(parent, { recursive: true, mode: 0o700 });
		const dir = await fs.mkdtemp(path.join(parent, 'terminal-'));
		await fs.chmod(dir, 0o700);
		const key = owned.NAND_ACCOUNT_ROOT!;
		const installation = (installations.get(key) ?? Promise.resolve()).catch(() => {}).then(() => {
			if (this.disposed) throw new AutomationError('agentUnavailable');
			return this.install(agent, owned);
		});
		installations.set(key, installation);
		try {
			await installation;
			if (this.disposed) throw new AutomationError('agentUnavailable');
		} catch (error) {
			await checkOwnedPath(dir); await fs.rm(dir, { recursive: true, force: true });
			throw error;
		} finally {
			if (installations.get(key) === installation) installations.delete(key);
		}
		this.slots.set(token, { dir, token, receive });
		this.timer ??= this.win.setInterval(() => {
			void this.poll();
		}, 300);
		return {
			// The shared script finds the runtime through the session's own environment, so no executable path sits in user configuration.
			env: { NAND_HOOK_DIR: dir, NAND_HOOK_TOKEN: token, NAND_HOOK_NODE: nodeProcess.execPath },
			close: () => {
				this.slots.delete(token);
				void checkOwnedPath(dir).then(() => fs.rm(dir, { recursive: true, force: true })).catch(console.error);
				if (!this.slots.size && this.timer !== undefined) {
					this.win.clearInterval(this.timer);
					this.timer = undefined;
				}
			},
		};
	}
	private async install(agent: AgentId, account: Record<string, string>): Promise<void> {
		const [fs, , path, process] = await nodeModules();
		// The system account writes into the user's real provider configuration; a managed one stays inside the vault.
		const system = isSystemAccount(account), env: Record<string, string> = { ...account, ...accountPaths(account) };
		if (system) {
			const [, os] = await nodeModules();
			const result: SystemHookResult = await installSystemHooks(agent, accountPaths(account), { home: os.homedir(), platform: process.platform }, HOOK_SCRIPT);
			if (!result.skipped.length) return;
			// A file NAND must not touch (a link, invalid JSON, a user's own extension) stays as it is; say so once.
			const message = t('agent.hooks.systemSkipped', { files: result.skipped.map(row => `${row.file} (${row.reason})`).join(', ') });
			if (this.options.strict) throw new Error(message);
			new Notice(message, 10000);
			return;
		}
		if (agent === 'pi' || agent === 'opencode') {
			const target = path.join(agent === 'pi' ? path.join(env.PI_CODING_AGENT_DIR!, 'extensions') : path.join(env.OPENCODE_CONFIG_DIR!, 'plugins'), agent === 'pi' ? 'nand-status.ts' : 'nand-status.mjs');
			await checkOwnedPath(target); await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
			await fs.writeFile(target, agent === 'pi' ? PI_EXTENSION : OPENCODE_EXTENSION, { mode: 0o600 });
			return;
		}
		const providers: Record<Exclude<AgentId, 'pi' | 'opencode'>, { file: string; events: string[] }> = {
			'claude-code': {
				file: path.join(
					env.CLAUDE_CONFIG_DIR!,
					'settings.json',
				),
				events: ['SessionStart', 'UserPromptSubmit', 'PermissionRequest', 'PreToolUse', 'Stop', 'StopFailure'],
			},
			codex: {
				file: path.join(env.CODEX_HOME!, 'hooks.json'),
				events: ['SessionStart', 'UserPromptSubmit', 'PermissionRequest', 'PreToolUse', 'Stop', 'Interrupt'],
			},
			gemini: {
				file: path.join(env.GEMINI_CLI_HOME!, '.gemini', 'settings.json'),
				events: ['SessionStart', 'BeforeAgent', 'BeforeTool', 'Notification', 'AfterAgent'],
			},
			grok: {
				file: path.join(
					env.GROK_HOME!,
					'hooks',
					'nand-status.json',
				),
				events: ['SessionStart', 'UserPromptSubmit', 'Stop', 'StopFailure', 'StopCancelled'],
			},
		};
		const provider = providers[agent];
		const script = path.join(env.NAND_ACCOUNT_ROOT!, 'runtime', SCRIPT_NAME);
		await checkOwnedPath(script);
		await fs.mkdir(path.dirname(script), { recursive: true, mode: 0o700 });
		await fs.writeFile(script, HOOK_SCRIPT, { mode: 0o600 });
		const merge = (raw: string | undefined) => JSON.stringify(mergeNativeHooks(
			raw === undefined ? {} : (JSON.parse(raw) as unknown), script, provider.events, process,
		), null, 2) + '\n';
		await checkOwnedPath(provider.file);
		await writeHookSettings(fs, provider.file, merge, checkOwnedPath);
	}
	private async poll(): Promise<void> {
		const [fs, , path] = await nodeModules();
		if (this.reading || this.disposed) return;
		this.reading = true;
		try {
			for (const slot of this.slots.values()) {
				try {
					await checkOwnedPath(slot.dir);
					for (const file of (await fs.readdir(slot.dir)).filter((name) => name.endsWith('.json')).sort()) {
						const full = path.join(slot.dir, file);
						try {
							await checkOwnedPath(full);
							const metadata = await fs.lstat(full);
							if (!metadata.isFile()) throw new AutomationError('hookInputInvalid');
							if (metadata.size > MAX_HOOK_INPUT_BYTES) {
								if (this.slots.has(slot.token)) slot.receive({ event: 'HookError', at: Date.now(), data: { nand_answer_error: 'hookInputTooLarge' } });
								continue;
							}
							const row = JSON.parse(await fs.readFile(full, 'utf8')) as NativeHookEvent & {
								token: string;
							};
							if (
								this.slots.has(slot.token) &&
								row.token === slot.token &&
								typeof row.event === 'string' &&
								Number.isFinite(row.at) &&
								row.data &&
								typeof row.data === 'object'
							)
								slot.receive(row);
						} finally {
							await checkOwnedPath(full); await fs.unlink(full).catch(() => {});
						}
					}
				} catch (error) {
					if (this.slots.has(slot.token)) { console.error('[NAND agent hooks]', error); slot.receive({ event: 'HookError', at: Date.now(), data: { nand_answer_error: 'hookInputInvalid' } }); }
				}
			}
		} finally {
			this.reading = false;
		}
	}
	dispose(): void {
		this.disposed = true;
		if (this.timer !== undefined) this.win.clearInterval(this.timer);
		for (const slot of this.slots.values())
			void nodeModules()
				.then(async ([fs]) => { await checkOwnedPath(slot.dir); await fs.rm(slot.dir, { recursive: true, force: true }); })
				.catch(console.error);
		this.slots.clear();
	}
}
