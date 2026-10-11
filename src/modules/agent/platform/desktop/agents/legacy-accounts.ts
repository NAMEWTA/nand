import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { readFile, readdir, lstat, writeFile, mkdir } from 'node:fs/promises';
import { JsonStore } from '../../../../../shared/json-store';
import { t } from '../../../../../shared/i18n/index';
import { nativeVaultStorage } from '../../../../../host/desktop/vault-storage';
import { absoluteNandPath } from '../../../../../host/desktop/nand-paths';
import { privatePathHasSymlink } from '../../../../../host/desktop/private-mode';
import { secureOwnedDirectory } from '../../../../../host/desktop/owned-permissions';
import { retainLegacyDirectory } from '../../../../../host/desktop/browser-session-migration';
import type { AgentId } from '../../../core/launch/types';

export interface LegacyAccountChoice { agent: AgentId; name: string; candidates: string[] }
interface Options { vault: string; device: string; plugin: string; boot: string; choose?: (options: LegacyAccountChoice) => Promise<string | null> }
const choices = new Map<string, NonNullable<Options['choose']>>();
const queues = new Map<string, Promise<unknown>>();
const ownedRoot = (device: string) => `.nand/agents/${device}`;
const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
async function exists(file: string): Promise<boolean> {
	try { await lstat(file); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
function strict<T>(base: T, next: T, remote: T): T {
	if (!isDeepStrictEqual(remote, base) && !isDeepStrictEqual(remote, next)) throw new Error(t('agent.legacyChanged'));
	return next;
}
async function serialized<T>(key: string, run: () => Promise<T>): Promise<T> {
	const operation = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(run);
	queues.set(key, operation);
	try { return await operation; } finally { if (queues.get(key) === operation) queues.delete(key); }
}

/** Retire only NAND's old plugin-owned accounts after a full main-process restart. */
export async function prepareLegacyAccounts(options: Options): Promise<() => void> {
	const { vault, device, plugin, boot } = options, relative = ownedRoot(device);
	const root = await absoluteNandPath(vault, relative), source = path.join(plugin, 'accounts');
	const sources = [[source, relative + '/legacy-accounts'], [path.join(plugin, 'binaries'), `.nand/helpers/${device}/legacy-plugin`]] as const;
	await serialized(root, async () => {
		const storage = nativeVaultStorage(vault);
		const store = new JsonStore<{ boot: string; source: string } | null>(storage, relative + '/legacy-cold-start.json', (value): value is { boot: string; source: string } | null => value === null || !!value && typeof value === 'object' && typeof (value as { boot?: unknown }).boot === 'string' && typeof (value as { source?: unknown }).source === 'string', strict);
		const observed = await store.load(null);
		if ((await Promise.all(sources.map(async ([from]) => { if (await privatePathHasSymlink(from)) throw new Error('private-storage.symlink'); return exists(from); }))).some(Boolean)) {
			await secureOwnedDirectory(vault, relative);
			if (!observed) { await store.commit({ base: null, value: { boot, source: digest(source) } }); throw new Error(t('agent.legacyRestart')); }
			if (observed.boot === boot) throw new Error(t('agent.legacyRestart'));
			if (observed.source !== digest(source)) throw new Error(t('agent.legacyChanged'));
		}
		if (observed) {
			await secureOwnedDirectory(vault, `.nand/helpers/${device}`);
			for (const [from, into] of sources) {
				const retained = await retainLegacyDirectory(vault, into, from);
				if (retained && !await exists(retained)) throw new Error(t('agent.legacyChanged'));
			}
			await secureOwnedDirectory(vault, relative, true);
			await secureOwnedDirectory(vault, `.nand/helpers/${device}`, true);
		}
	});
	if (options.choose) choices.set(root, options.choose);
	return () => { if (choices.get(root) === options.choose) choices.delete(root); };
}

interface Binding { version: 1; name: string; candidate: string | null; phase: 'copying' | 'ready'; files: Record<string, string> }
function valid(value: unknown): value is Binding | null {
	if (value === null) return true;
	const row = value as Partial<Binding>;
	return !!row && row.version === 1 && typeof row.name === 'string' && (row.candidate === null || typeof row.candidate === 'string' && /^[a-z\d_-]+$/i.test(row.candidate)) && (row.phase === 'copying' || row.phase === 'ready')
		&& !!row.files && typeof row.files === 'object' && !Array.isArray(row.files) && Object.entries(row.files).every(([file, hash]) => !!file && !file.includes('\\') && file.split('/').every(part => !!part && part !== '.' && part !== '..' && !part.includes(':')) && /^[a-f\d]{64}$/.test(hash));
}
async function snapshot(root: string): Promise<Record<string, string>> {
	const result: Record<string, string> = Object.create(null) as Record<string, string>;
	let count = 0;
	const visit = async (relative: string): Promise<void> => {
		const file = path.join(root, relative);
		if (++count > 20000 || await privatePathHasSymlink(file)) throw new Error(t('agent.legacyChanged'));
		const info = await lstat(file);
		if (info.isDirectory()) for (const name of await readdir(file)) await visit(relative ? relative + '/' + name : name);
		else if (info.isFile()) result[relative] = digest(await readFile(file));
		else throw new Error(t('agent.legacyChanged'));
	};
	await visit(''); return Object.fromEntries(Object.entries(result));
}

/** Lossy old names never select credentials implicitly. The preserved archive remains a recovery copy. */
export async function legacyAccountConfig(vault: string, device: string, agent: AgentId, name: string, owner: string, interactive: boolean): Promise<string | undefined> {
	if (agent !== 'claude-code' && agent !== 'codex') return undefined;
	const relative = ownedRoot(device), root = await absoluteNandPath(vault, relative);
	const identity = relative + '/' + path.relative(root, owner).split(path.sep).join('/');
	return serialized(owner, async () => {
		const storage = nativeVaultStorage(vault), store = new JsonStore<Binding | null>(storage, identity + '/legacy-binding.json', valid, strict);
		let binding = await store.load(null);
		const archiveRelative = `${relative}/legacy-accounts/files/${agent === 'claude-code' ? 'claude' : 'codex'}`;
		const archive = await absoluteNandPath(vault, archiveRelative);
		if (!binding) {
			if (!await exists(archive)) return undefined;
			const candidates: string[] = [];
			for (const item of await readdir(archive, { withFileTypes: true })) {
				if (item.isSymbolicLink() || !/^[a-z\d_-]+$/i.test(item.name)) throw new Error(t('agent.legacyChanged'));
				if (item.isDirectory() && await exists(await absoluteNandPath(vault, archiveRelative + '/' + item.name + '/home'))) candidates.push(item.name);
			}
			if (!candidates.length) return undefined;
			const choose = interactive ? choices.get(root) : undefined;
			if (!choose) throw new Error(t('agent.legacyChoice'));
			const candidate = await choose({ agent, name, candidates: candidates.sort() });
			if (candidate !== null && !candidates.includes(candidate)) throw new Error(t('agent.legacyChanged'));
			binding = await store.commit({ base: null, value: { version: 1, name, candidate, phase: candidate === null ? 'ready' : 'copying', files: candidate === null ? {} : await snapshot(path.join(archive, candidate, 'home')) } });
		}
		if (binding!.name !== name) throw new Error(t('agent.legacyChanged'));
		if (binding!.candidate === null) return undefined;
		const destination = await absoluteNandPath(vault, identity + '/legacy-config');
		if (binding!.phase === 'ready') {
			if (!await exists(destination)) throw new Error(t('agent.legacyChanged'));
			return destination;
		}
		const source = await absoluteNandPath(vault, archiveRelative + '/' + binding!.candidate + '/home');
		if (!isDeepStrictEqual(await snapshot(source), binding!.files)) throw new Error(t('agent.legacyChanged'));
		await storage.mkdir(identity + '/legacy-config');
		for (const [file, hash] of Object.entries(binding!.files)) {
			const target = await absoluteNandPath(vault, identity + '/legacy-config/' + file);
			const bytes = await readFile(await absoluteNandPath(vault, archiveRelative + '/' + binding!.candidate + '/home/' + file));
			if (digest(bytes) !== hash) throw new Error(t('agent.legacyChanged'));
			await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
			try { await writeFile(target, bytes, { mode: 0o600, flag: 'wx' }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
			if (digest(await readFile(target)) !== hash) throw new Error(t('agent.legacyChanged'));
		}
		if (!isDeepStrictEqual(await snapshot(destination), binding!.files) || !isDeepStrictEqual(await snapshot(source), binding!.files)) throw new Error(t('agent.legacyChanged'));
		await store.commit({ base: binding, value: { ...binding!, phase: 'ready' } });
		return destination;
	});
}
