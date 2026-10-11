import path from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, copyFile, lstat, mkdir, readdir, rename, rmdir, unlink } from 'node:fs/promises';
import { JsonStore } from '../../shared/json-store';
import { nativeVaultStorage } from './vault-storage';
import { absoluteNandPath } from './nand-paths';
import { privatePathHasSymlink } from './private-mode';

interface Receipt {
	version: 1;
	source: string;
	origin?: string;
	boot: string;
	phase: 'restart' | 'copying' | 'published' | 'complete' | 'fresh';
	files: Record<string, string>;
}
export interface SessionMigration {
	vault: string;
	relative: string;
	source?: string;
	boot: string;
	active(directory: string): boolean;
	ambiguous?: boolean;
	choose?(): Promise<'copy' | 'fresh'>;
}
const operations = new Map<string, Promise<string>>();
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const safeFile = (file: string) => file.length > 0 && !file.includes('\\') && file.split('/').every(part => part && part !== '.' && part !== '..' && !part.includes(':') && [...part].every(char => char.charCodeAt(0) >= 32));
function valid(value: unknown): value is Receipt | null {
	if (value === null) return true;
	if (!value || typeof value !== 'object') return false;
	const row = value as Partial<Receipt>;
	return row.version === 1 && typeof row.source === 'string' && /^[a-f\d]{64}$/.test(row.source) && typeof row.boot === 'string'
		&& (row.origin === undefined || typeof row.origin === 'string' && digest(row.origin) === row.source)
		&& ['restart', 'copying', 'published', 'complete', 'fresh'].includes(row.phase ?? '') && !!row.files && typeof row.files === 'object' && !Array.isArray(row.files)
		&& Object.entries(row.files).every(([file, hash]) => safeFile(file) && typeof hash === 'string' && /^[a-f\d]{64}$/.test(hash));
}
async function exists(file: string): Promise<boolean> {
	try { await lstat(file); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
async function check(directory: string): Promise<void> {
	if (await privatePathHasSymlink(directory)) throw new Error('private-storage.symlink');
}
async function fileHash(file: string): Promise<string> {
	await check(file);
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
	return hash.digest('hex');
}
async function snapshot(directory: string): Promise<Record<string, string>> {
	const files: Record<string, string> = {};
	const walk = async (relative: string): Promise<void> => {
		const current = path.join(directory, relative); await check(current);
		for (const item of await readdir(current, { withFileTypes: true })) {
			const file = relative ? relative + '/' + item.name : item.name;
			if (!safeFile(file) || item.isSymbolicLink()) throw new Error('browser_session_unsafe_source');
			if (item.isDirectory()) await walk(file);
			else if (item.isFile()) files[file] = await fileHash(path.join(directory, file));
			else throw new Error('browser_session_unsafe_source');
		}
	};
	await walk(''); return files;
}
const sameFiles = (a: Record<string, string>, b: Record<string, string>) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([file, hash]) => b[file] === hash);
async function copyVerified(source: string, target: string, files: Record<string, string>): Promise<void> {
	await check(target); await mkdir(target, { recursive: true, mode: 0o700 });
	for (const [file, hash] of Object.entries(files)) {
		const from = path.join(source, file), to = path.join(target, file);
		await check(from); await check(to); await mkdir(path.dirname(to), { recursive: true, mode: 0o700 });
		if (!await exists(to) || await fileHash(to) !== hash) await copyFile(from, to);
		if (process.platform !== 'win32') await chmod(to, 0o600);
		if (await fileHash(to) !== hash) throw new Error('browser_session_source_changed');
	}
	if (!sameFiles(await snapshot(target), files) || !sameFiles(await snapshot(source), files)) throw new Error('browser_session_source_changed');
}
async function removeVerifiedSource(source: string, backup: string, files: Record<string, string>): Promise<void> {
	if (!sameFiles(await snapshot(backup), files)) throw new Error('browser_session_source_changed');
	const remaining = await snapshot(source);
	if (Object.entries(remaining).some(([file, hash]) => files[file] !== hash)) throw new Error('browser_session_source_changed');
	for (const [file, hash] of Object.entries(remaining)) {
		const target = path.join(source, file);
		if (await fileHash(target) !== hash) throw new Error('browser_session_source_changed');
		await unlink(target);
	}
	const empty = async (directory: string): Promise<void> => {
		await check(directory);
		for (const item of await readdir(directory, { withFileTypes: true })) {
			if (!item.isDirectory() || item.isSymbolicLink()) throw new Error('browser_session_source_changed');
			await empty(path.join(directory, item.name));
		}
		await rmdir(directory);
	};
	await empty(source);
}

/** Cold-copy Chromium databases before opening Session.fromPath. Never replay a completed migration.
 * The first successful new-process startup retains the old bytes under the vault before cleanup.
 */
export function prepareSessionDirectory(options: SessionMigration): Promise<string> {
	const key = path.resolve(options.vault, options.relative);
	const previous = operations.get(key) ?? Promise.resolve('');
	const operation = previous.catch(() => '').then(() => prepare(options));
	operations.set(key, operation);
	void operation.finally(() => { if (operations.get(key) === operation) operations.delete(key); }).catch(() => undefined);
	return operation;
}
async function prepare(options: SessionMigration): Promise<string> {
	const { vault, relative, source, boot } = options;
	const root = await absoluteNandPath(vault, relative), target = await absoluteNandPath(vault, relative + '/session');
	const storage = nativeVaultStorage(vault), receiptPath = relative + '/migration.json';
	const receiptExisted = await storage.exists(receiptPath) || await storage.exists(receiptPath + '.backup');
	const store = new JsonStore<Receipt | null>(storage, receiptPath, valid);
	let receipt = await store.load(null);
	if (!receipt && receiptExisted) throw new Error('browser_session_receipt_invalid');
	const sourceKey = digest(source ?? '');
	const save = async (value: Receipt) => { receipt = await store.commit({ base: receipt, value }); };
	if (receipt?.phase === 'fresh' || receipt?.phase === 'complete') {
		await storage.mkdir(relative + '/session'); return target;
	}
	if (receipt && receipt.source !== sourceKey) throw new Error('browser_session_source_changed');
	if (!receipt) {
		if (await exists(target)) throw new Error('browser_session_unclaimed');
		let fresh = !source || !await exists(source);
		if (!fresh && options.ambiguous) {
			if (!options.choose) throw new Error('browser_session_choice');
			fresh = await options.choose() === 'fresh';
		}
		await save({ version: 1, source: sourceKey, origin: source ?? '', boot, phase: fresh ? 'fresh' : 'restart', files: {} });
		if (fresh) { await storage.mkdir(relative + '/session'); return target; }
	}
	if (!source) throw new Error('browser_session_source_changed');
	if (options.active(source) || receipt!.boot === boot && receipt!.phase === 'restart') throw new Error('browser_session_restart');
	if (receipt!.phase === 'restart') await save({ ...receipt!, boot, phase: 'copying', files: await snapshot(source) });
	if (receipt!.phase === 'copying') {
		if (!sameFiles(await snapshot(source), receipt!.files)) throw new Error('browser_session_source_changed');
		if (await exists(target)) {
			if (!sameFiles(await snapshot(target), receipt!.files)) throw new Error('browser_session_source_changed');
		} else {
			const stage = path.join(root, 'session-copy');
			await copyVerified(source, stage, receipt!.files);
			await check(target); await rename(stage, target);
		}
		await save({ ...receipt!, boot, phase: 'published' });
	}
	if (receipt!.phase === 'published' && receipt!.boot !== boot) {
		const backup = path.join(root, 'legacy-original');
		if (await exists(source)) {
			// A prior cleanup may have removed only part of the source. The complete backup wins.
			if (!await exists(backup) || !sameFiles(await snapshot(backup), receipt!.files)) await copyVerified(source, backup, receipt!.files);
			await removeVerifiedSource(source, backup, receipt!.files);
		} else if (!await exists(backup) || !sameFiles(await snapshot(backup), receipt!.files)) throw new Error('browser_session_source_changed');
		await save({ ...receipt!, phase: 'complete' });
	}
	return target;
}

/** Retain an inactive, explicitly owned legacy tree in the vault. No retained script is executed. */
export async function retainLegacyDirectory(vault: string, relative: string, source: string): Promise<string | undefined> {
	const target = await absoluteNandPath(vault, relative + '/files'), storage = nativeVaultStorage(vault), file = relative + '/migration.json';
	const existed = await storage.exists(file) || await storage.exists(file + '.backup');
	const store = new JsonStore<Receipt | null>(storage, file, valid);
	let receipt = await store.load(null);
	if (!receipt && existed) throw new Error('browser_session_receipt_invalid');
	if (receipt?.phase === 'complete') {
		if (await exists(source)) throw new Error('browser_session_source_changed');
		return target;
	}
	if (receipt && receipt.source !== digest(source)) throw new Error('browser_session_source_changed');
	if (!receipt && !await exists(source)) return undefined;
	const save = async (value: Receipt) => { receipt = await store.commit({ base: receipt, value }); };
	if (!receipt) await save({ version: 1, source: digest(source), origin: source, boot: 'inactive-files', phase: 'copying', files: await snapshot(source) });
	if (receipt!.phase === 'copying') {
		await copyVerified(source, target, receipt!.files);
		await save({ ...receipt!, phase: 'published' });
	}
	if (receipt!.phase !== 'published') throw new Error('browser_session_receipt_invalid');
	if (await exists(source)) await removeVerifiedSource(source, target, receipt!.files);
	else if (!sameFiles(await snapshot(target), receipt!.files)) throw new Error('browser_session_source_changed');
	await save({ ...receipt!, phase: 'complete' });
	return target;
}
