import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { privatePathHasSymlink } from '../../../../../host/desktop/private-mode';
import { PI_EXTENSION, OPENCODE_EXTENSION } from './native-extensions';
import { writeHookSettings } from './settings-write';
import type { AgentId } from '../../../core/launch/types';
/** Only remove this plugin's generated entries; preserve provider/user hook settings. */
export async function removeStatusHooks(id: AgentId, env: Record<string, string>): Promise<void> {
	const owned = env.NAND_ACCOUNT_ROOT!;
	const file =
		id === 'claude-code'
			? path.join(env.CLAUDE_CONFIG_DIR!, 'settings.json')
			: id === 'codex'
				? path.join(env.CODEX_HOME!, 'hooks.json')
				: id === 'gemini'
					? path.join(env.GEMINI_CLI_HOME!, '.gemini', 'settings.json')
					: id === 'grok'
						? path.join(env.GROK_HOME!, 'hooks', 'nand-status.json')
						: id === 'pi'
							? path.join(env.PI_CODING_AGENT_DIR!, 'extensions', 'nand-status.ts')
							: path.join(env.OPENCODE_CONFIG_DIR!, 'plugins', 'nand-status.mjs');
	const check = async (target: string) => {
		if (await privatePathHasSymlink(target)) throw new Error('private-storage.symlink');
	};
	await check(file);
	let raw: string;
	try {
		raw = await fs.readFile(file, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
		throw error;
	}
	if (id === 'pi' || id === 'opencode') {
		if (raw !== (id === 'pi' ? PI_EXTENSION : OPENCODE_EXTENSION)) return;
		await fs.unlink(file);
		return;
	}
	if (!raw.includes('nand-automation-hook.cjs')) return;
	await writeHookSettings(
		fs,
		file,
		(text) => {
			const value: unknown = JSON.parse(text || '{}');
			if (!value || typeof value !== 'object') throw new Error('Invalid hook settings');
			const data = value as { hooks?: Record<string, unknown> };
			if (data.hooks)
				for (const [event, rows] of Object.entries(data.hooks)) {
					if (Array.isArray(rows))
						data.hooks[event] = rows.flatMap((row: unknown) => {
							if (!row || typeof row !== 'object' || Array.isArray(row)) return [row];
							const group = row as { hooks?: unknown[]; command?: unknown };
							const ours = (entry: unknown) => {
								if (!entry || typeof entry !== 'object') return false;
								const command = (entry as { command?: unknown }).command;
								return (
									typeof command === 'string' &&
									command.includes('nand-automation-hook.cjs') &&
									command.includes(owned)
								);
							};
							if (!Array.isArray(group.hooks)) return ours(group) ? [] : [row];
							const hooks = group.hooks.filter((entry) => !ours(entry));
							return hooks.length ? [{ ...group, hooks }] : [];
						});
				}
			return JSON.stringify(data, null, 2) + '\n';
		},
		check,
	);
}
