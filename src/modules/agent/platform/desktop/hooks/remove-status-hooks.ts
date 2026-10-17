import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { privatePathHasSymlink } from '../../../../../host/desktop/private-mode';
import { PI_EXTENSION, OPENCODE_EXTENSION } from './native-extensions';
import { writeHookSettings } from './settings-write';
import { stripOwnedHooks } from './hook-entries';
import type { AgentId } from '../../../core/launch/types';
import { accountPaths, isSystemAccount } from '../agents/system-homes';

const SCRIPT = 'nand-automation-hook.cjs';

/** Remove a managed account's generated entries; preserve provider/user hook settings. The system account is never touched here: its entries leave only through `removeSystemHooks`. */
export async function removeStatusHooks(id: AgentId, account: Record<string, string>): Promise<void> {
	if (isSystemAccount(account)) return;
	const owned = account.NAND_ACCOUNT_ROOT!, env: Record<string, string> = { ...account, ...accountPaths(account) };
	const owns = (command: string) => command.includes(SCRIPT) && command.includes(owned);
	const strip = (text: string): string => {
		const value: unknown = JSON.parse(text || '{}');
		if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid hook settings');
		const result = stripOwnedHooks(value as Record<string, unknown>, owns);
		return result.removed ? JSON.stringify(result.settings, null, 2) + '\n' : text;
	};
	if (id === 'pi' || id === 'opencode') {
		const directory = id === 'pi' ? path.join(env.PI_CODING_AGENT_DIR!, 'extensions') : path.join(env.OPENCODE_CONFIG_DIR!, 'plugins');
		const file = path.join(directory, id === 'pi' ? 'nand-status.ts' : 'nand-status.mjs');
		if (await privatePathHasSymlink(file)) throw new Error('private-storage.symlink');
		let raw: string;
		try { raw = await fs.readFile(file, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
		if (raw !== (id === 'pi' ? PI_EXTENSION : OPENCODE_EXTENSION)) return;
		await fs.unlink(file);
		return;
	}
	const file =
		id === 'claude-code'
			? path.join(env.CLAUDE_CONFIG_DIR!, 'settings.json')
			: id === 'codex'
				? path.join(env.CODEX_HOME!, 'hooks.json')
				: id === 'gemini'
					? path.join(env.GEMINI_CLI_HOME!, '.gemini', 'settings.json')
					: path.join(env.GROK_HOME!, 'hooks', 'nand-status.json');
	const check = async (target: string) => { if (await privatePathHasSymlink(target)) throw new Error('private-storage.symlink'); };
	await check(file);
	let raw: string;
	try { raw = await fs.readFile(file, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
	if (!raw.includes(SCRIPT)) return;
	await writeHookSettings(fs, file, text => strip(text ?? ""), check);
}
