import path from 'node:path';
import { lstat } from 'node:fs/promises';
import { AGENT_CATALOG } from '../../../core/launch/catalog';
import type { AgentId } from '../../../core/launch/types';
import { absoluteNandPath } from '../../../../../host/desktop/nand-paths';
import { nativeVaultStorage } from '../../../../../host/desktop/vault-storage';
import { accountConfigDir, managedHomes } from './accounts';
import { managedAccountHasData } from './credentials';

const marker = (device: string) => `.nand/agents/${device}/default-account-adopted`;

async function ownerOf(vault: string, device: string, agent: AgentId): Promise<string> {
	const root = await absoluteNandPath(vault, `.nand/agents/${device}`);
	return path.dirname(accountConfigDir(agent, '', root));
}

async function exists(file: string): Promise<boolean> {
	try { await lstat(file); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}

/**
 * Providers whose former vault default account holds a login or history. They are kept as a named managed account;
 * nothing is moved or deleted. Reported once per device, so removing the entry later is respected.
 */
export async function legacyDefaultAccountsToAdopt(vault: string, device: string): Promise<AgentId[]> {
	const storage = nativeVaultStorage(vault);
	if (await storage.exists(marker(device))) return [];
	const result: AgentId[] = [];
	for (const agent of AGENT_CATALOG) {
		const owner = await ownerOf(vault, device, agent.id), home = path.join(owner, 'home');
		if (!await exists(home)) continue;
		if (await exists(path.join(owner, 'legacy-config')) || await managedAccountHasData(agent, managedHomes(home, owner))) result.push(agent.id);
	}
	return result;
}

export async function markLegacyDefaultAdopted(vault: string, device: string): Promise<void> {
	await nativeVaultStorage(vault).write(marker(device), new Date().toISOString());
}

/** Whether a transcript lives in the vault's former default account directory, so a session saved before the change resumes there. */
export async function inLegacyDefaultAccount(vault: string, device: string, agent: AgentId, transcript: string): Promise<boolean> {
	const owner = await ownerOf(vault, device, agent), relative = path.relative(owner, transcript);
	return !!relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
