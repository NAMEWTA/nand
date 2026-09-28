import { Platform } from 'obsidian';
import { AutomationError } from '../../../shared/automation/errors';
import { OPENCODE_EXTENSION, PI_EXTENSION } from './native-extensions';

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
// An inert user hook outside NAND: no network, no prompt logging, no effect unless
// this particular child process inherited a private automation event directory.
export const HOOK_SCRIPT = `const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = process.env.NAND_HOOK_DIR, token = process.env.NAND_HOOK_TOKEN;
if (!dir || !token) process.exit(0);
let input = ''; process.stdin.setEncoding('utf8');
const timeout = setTimeout(() => process.exit(0), 3000);
process.stdin.on('data', data => { input += data; if (input.length > 65536) process.exit(0); });
process.stdin.on('end', () => { try {
 const data = JSON.parse(input || '{}');
 const name = process.hrtime.bigint().toString().padStart(24, '0') + '-' + crypto.randomUUID();
 const file = path.join(dir, name);
 fs.writeFileSync(file + '.pending', JSON.stringify({ token, event: process.argv[2], at: Date.now(), data }), { mode: 0o600 });
 fs.renameSync(file + '.pending', file + '.json');
} catch {} clearTimeout(timeout); });
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
		const rows = (previous as unknown[]).filter((row: unknown) => !JSON.stringify(row).includes(SCRIPT_NAME));
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
	private timer?: number;
	private reading = false;
	private slots = new Map<string, { dir: string; token: string; receive: (event: NativeHookEvent) => void }>();
	private installTail: Promise<void> = Promise.resolve();
	constructor(private win: Window) {}
	async prepare(
		agent: string,
		env: Record<string, string>,
		receive: (event: NativeHookEvent) => void,
	): Promise<{ env: Record<string, string>; close(): void }> {
		const [fs, os, path] = await nodeModules();
		const token = crypto.randomUUID();
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nand-automation-'));
		await fs.chmod(dir, 0o700);
		const installation = this.installTail.then(() => this.install(agent, env));
		this.installTail = installation.catch(() => {});
		try {
			await installation;
		} catch (error) {
			await fs.rm(dir, { recursive: true, force: true });
			throw error;
		}
		this.slots.set(token, { dir, token, receive });
		this.timer ??= this.win.setInterval(() => {
			void this.poll();
		}, 300);
		return {
			env: { NAND_HOOK_DIR: dir, NAND_HOOK_TOKEN: token },
			close: () => {
				this.slots.delete(token);
				void fs.rm(dir, { recursive: true, force: true }).catch(console.error);
				if (!this.slots.size && this.timer !== undefined) {
					this.win.clearInterval(this.timer);
					this.timer = undefined;
				}
			},
		};
	}
	private async install(agent: string, env: Record<string, string>): Promise<void> {
		const [fs, os, path, process] = await nodeModules();
		const home = os.homedir();
		if (agent === 'pi' || agent === 'opencode') {
			const file =
				agent === 'pi'
					? path.join(
							env.PI_CODING_AGENT_DIR ||
								process.env.PI_CODING_AGENT_DIR ||
								path.join(home, '.pi', 'agent'),
							'extensions',
							'nand-status.ts',
						)
					: path.join(
							process.env.XDG_CONFIG_HOME || path.join(home, '.config'),
							'opencode',
							'plugins',
							'nand-status.mjs',
						);
			await fs.mkdir(path.dirname(file), { recursive: true });
			await fs.writeFile(file, agent === 'pi' ? PI_EXTENSION : OPENCODE_EXTENSION, { mode: 0o600 });
			return;
		}
		const providers: Record<string, { file: string; events: string[] }> = {
			'claude-code': {
				file: path.join(
					env.CLAUDE_CONFIG_DIR || process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'),
					'settings.json',
				),
				events: ['SessionStart', 'UserPromptSubmit', 'Stop', 'StopFailure'],
			},
			codex: {
				file: path.join(env.CODEX_HOME || process.env.CODEX_HOME || path.join(home, '.codex'), 'hooks.json'),
				events: ['SessionStart', 'UserPromptSubmit', 'Stop'],
			},
			gemini: {
				file: path.join(home, '.gemini', 'settings.json'),
				events: ['SessionStart', 'BeforeAgent', 'AfterAgent'],
			},
			grok: {
				file: path.join(
					env.GROK_HOME || process.env.GROK_HOME || path.join(home, '.grok'),
					'hooks',
					'nand-status.json',
				),
				events: ['SessionStart', 'UserPromptSubmit', 'Stop', 'StopFailure', 'StopCancelled'],
			},
			droid: {
				file: path.join(home, '.factory', 'settings.json'),
				events: ['SessionStart', 'UserPromptSubmit', 'Stop'],
			},
		};
		const provider = providers[agent];
		if (!provider) return;
		const script = path.join(home, '.nand', 'hooks', SCRIPT_NAME);
		await fs.mkdir(path.dirname(script), { recursive: true });
		await fs.writeFile(script, HOOK_SCRIPT, { mode: 0o600 });
		let raw: string | undefined;
		try {
			raw = await fs.readFile(provider.file, 'utf8');
		} catch (error) {
			if ((error as { code?: string }).code !== 'ENOENT') throw error;
		}
		const settings = mergeNativeHooks(
			raw === undefined ? {} : (JSON.parse(raw) as unknown),
			script,
			provider.events,
			process,
		);
		await fs.mkdir(path.dirname(provider.file), { recursive: true });
		if (raw !== undefined) await fs.writeFile(`${provider.file}.nand-backup`, raw, { mode: 0o600 });
		const next = `${provider.file}.nand-pending`;
		await fs.writeFile(next, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
		// Refuse to replace settings changed by a different process during installation.
		let current: string | undefined;
		try {
			current = await fs.readFile(provider.file, 'utf8');
		} catch (error) {
			if ((error as { code?: string }).code !== 'ENOENT') throw error;
		}
		if (current !== raw) {
			await fs.unlink(next);
			throw new AutomationError('hookSettingsChanged');
		}
		await fs.rename(next, provider.file);
	}
	private async poll(): Promise<void> {
		const [fs, , path] = await nodeModules();
		if (this.reading) return;
		this.reading = true;
		try {
			for (const slot of this.slots.values()) {
				try {
					for (const file of (await fs.readdir(slot.dir)).filter((name) => name.endsWith('.json')).sort()) {
						const full = path.join(slot.dir, file);
						try {
							if ((await fs.stat(full)).size > 100_000) continue;
							const row = JSON.parse(await fs.readFile(full, 'utf8')) as NativeHookEvent & {
								token: string;
							};
							if (
								row.token === slot.token &&
								typeof row.event === 'string' &&
								Number.isFinite(row.at) &&
								row.data &&
								typeof row.data === 'object'
							)
								slot.receive(row);
						} finally {
							await fs.unlink(full).catch(() => {});
						}
					}
				} catch (error) {
					if (this.slots.has(slot.token)) console.error('[NAND agent hooks]', error);
				}
			}
		} finally {
			this.reading = false;
		}
	}
	dispose(): void {
		if (this.timer !== undefined) this.win.clearInterval(this.timer);
		for (const slot of this.slots.values())
			void nodeModules()
				.then(([fs]) => fs.rm(slot.dir, { recursive: true, force: true }))
				.catch(console.error);
		this.slots.clear();
	}
}
