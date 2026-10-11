import path from 'node:path';
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { JsonStore } from '../../../../../shared/json-store';
import { nativeVaultStorage } from '../../../../../host/desktop/vault-storage';
import { absoluteNandPath } from '../../../../../host/desktop/nand-paths';
import { t } from '../../../../../shared/i18n';
import { accountName } from '../../../core/launch/account-name';
import type { AgentId } from '../../../core/launch/types';

interface Binding { name: string; candidate: string | null; phase: string }
interface Origin { phase: string; origin: string; source: string }
export interface LegacyReference { name: string; from: string; to: string; env: Record<string, string> }
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Only a completed, explicitly selected binding can interpret an old account reference. */
export async function legacyReferences(vault: string, device: string, agent: AgentId): Promise<LegacyReference[]> {
	if (agent !== 'claude-code' && agent !== 'codex') return [];
	const base = `.nand/agents/${device}`, storage = nativeVaultStorage(vault);
	const origin = await new JsonStore<Origin | null>(storage, base + '/legacy-accounts/migration.json', (value): value is Origin | null => value === null || !!value && typeof value === 'object' && ['phase', 'origin', 'source'].every(key => typeof (value as Record<string, unknown>)[key] === 'string')).load(null);
	if (!origin || origin.phase !== 'complete' || hash(origin.origin) !== origin.source) return [];
	const directory = base + '/accounts/' + agent;
	let entries;
	try { entries = await readdir(await absoluteNandPath(vault, directory), { withFileTypes: true }); }
	catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
	if (entries.length > 1000) throw new Error(t('agent.legacyChanged'));
	const result: LegacyReference[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
		const binding = await new JsonStore<Binding | null>(storage, directory + '/' + entry.name + '/legacy-binding.json', (value): value is Binding | null => value === null || !!value && typeof value === 'object' && typeof (value as Binding).name === 'string' && typeof (value as Binding).phase === 'string' && ((value as Binding).candidate === null || typeof (value as Binding).candidate === 'string')).load(null);
		if (!binding || binding.phase !== 'ready' || binding.candidate === null) continue;
		if (!/^[a-z\d_-]+$/i.test(binding.candidate) || accountName(binding.name) !== binding.name || (binding.name ? hash(binding.name) : 'default') !== entry.name) throw new Error(t('agent.legacyChanged'));
		const from = path.join(origin.origin, agent === 'claude-code' ? 'claude' : 'codex', binding.candidate, 'home');
		const to = await absoluteNandPath(vault, directory + '/' + entry.name + '/legacy-config');
		result.push({ name: binding.name, from, to, env: { [agent === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR']: from } });
	}
	return result;
}

export function uniqueLegacyReference(references: LegacyReference[], saved: Record<string, string>): LegacyReference | undefined {
	const entries = Object.entries(saved);
	if (entries.length !== 1) return undefined;
	const candidates = references.filter(reference => Object.entries(reference.env).every(([key, value]) => saved[key] === value));
	if (candidates.length > 1) throw new Error(t('agent.accountScopeMismatch'));
	return candidates[0];
}
