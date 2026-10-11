import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
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
	verified?: boolean;
	retirement?: string;
}
export interface SessionMigration {
	vault: string;
	relative: string;
	source?: string;
	boot: string;
	active(directory: string): boolean;
	ambiguous?: boolean;
	choose?(sourceMissing?: boolean): Promise<'copy' | 'fresh'>;
}
const operations = new Map<string, Promise<string>>();
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const safeFile = (file: string) => file.length > 0 && !file.includes('\\') && file.split('/').every(part => part && part !== '.' && part !== '..' && !part.includes(':') && [...part].every(char => char.charCodeAt(0) >= 32));
function valid(value: unknown): value is Receipt | null {
	if (value === null) return true;
	if (!value || typeof value !== 'object') return false;
	const row = value as Partial<Receipt>;
	return row.version === 1 && typeof row.source === 'string' && /^[a-f\d]{64}$/.test(row.source) && typeof row.boot === 'string'
		&& (row.verified === undefined || typeof row.verified === 'boolean')
		&& (row.retirement === undefined || typeof row.retirement === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(row.retirement))
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
	const files: Record<string, string> = Object.create(null) as Record<string, string>;
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
/** A copied or synced session may contain links below its root; Chromium must never follow them. */
async function checkSessionTree(directory: string): Promise<void> {
	await check(directory);
	for (const item of await readdir(directory, { withFileTypes: true })) {
		if (item.isSymbolicLink()) throw new Error('private-storage.symlink');
		if (item.isDirectory()) await checkSessionTree(path.join(directory, item.name));
		else if (!item.isFile()) throw new Error('browser_session_unsafe_source');
	}
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
async function removeVerifiedSource(source: string, backup: string, files: Record<string, string>, retirement: string): Promise<void> {
	if (!sameFiles(await snapshot(backup), files)) throw new Error('browser_session_source_changed');
	// Claim the actual directory atomically on its own filesystem. A new source at the old
	// path is a different writer's data and is never part of this cleanup or a retry.
	const claimed = path.join(path.dirname(source), '.nand-retired-' + retirement);
	await check(source); await check(claimed);
	if (!await exists(claimed)) {
		if (!await exists(source)) return;
		await rename(source, claimed);
	} else if (await exists(source)) throw new Error('browser_session_source_changed');
	if (await exists(source)) throw new Error('browser_session_source_changed');
	const remaining = await snapshot(claimed);
	if (Object.entries(remaining).some(([file, hash]) => files[file] !== hash)) throw new Error('browser_session_source_changed');
	for (const [file, hash] of Object.entries(remaining)) {
		const target = path.join(claimed, file);
		if (await fileHash(target) !== hash) throw new Error('browser_session_source_changed');
		await unlink(target);
	}
	const empty = async (directory: string): Promise<void> => {
		await check(directory);
		for (const item of await readdir(directory, { withFileTypes: true })) {
			if (!item.isDirectory() || item.isSymbolicLink()) throw new Error('browser_session_source_changed');
			await empty(path.join(directory, item.name));
		}
		// Keep the empty claim until the complete receipt is durable. It identifies a
		// finished cleanup after a crash; a replacement at source must never be claimed.
		if (directory !== claimed) await rmdir(directory);
	};
	await empty(claimed);
	if (await exists(source)) throw new Error('browser_session_source_changed');
}
async function removeEmptyClaim(source: string | undefined, retirement: string | undefined): Promise<void> {
	if (!source || !retirement) return;
	const claimed = path.join(path.dirname(source), '.nand-retired-' + retirement);
	await check(claimed);
	if (await exists(claimed)) await rmdir(claimed);
}

async function saveReceipt(storage: ReturnType<typeof nativeVaultStorage>, file: string, store: JsonStore<Receipt | null>, base: Receipt | null, value: Receipt): Promise<Receipt> {
	if (!base) {
		// The first recovery copy contains the explicit choice, rather than an uninformative null.
		await storage.mkdir(path.posix.dirname(file));
		const text = JSON.stringify(value); await storage.write(file + '.backup', text);
		if (await storage.read(file + '.backup') !== text) throw new Error('browser_session_receipt_invalid');
		base = await store.load(null);
	}
	return (await store.commit({ base, value }))!;
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
	const store = new JsonStore<Receipt | null>(storage, receiptPath, valid);
	let receipt = await store.load(null);
	const sourceKey = digest(source ?? '');
	const save = async (value: Receipt) => { receipt = await saveReceipt(storage, receiptPath, store, receipt, value); };
	if (receipt?.phase === 'fresh' || receipt?.phase === 'complete') {
		if ((receipt.phase === 'complete' || receipt.verified) && !await exists(target)) throw new Error('browser_session_unclaimed');
		if (receipt.source === sourceKey) await removeEmptyClaim(source, receipt.retirement);
		await storage.mkdir(relative + '/session'); await checkSessionTree(target); return target;
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
		if (fresh) { await storage.mkdir(relative + '/session'); await checkSessionTree(target); return target; }
	}
	if (!source) throw new Error('browser_session_source_changed');
	let copySource = source;
	if (['restart', 'copying'].includes(receipt!.phase) && !await exists(source)) {
		// Another explicitly selected vault may have finished first. Do not silently
		// discard this vault's choice; let its owner choose a new login or restore data.
		let retained: string | undefined;
		if (receipt!.phase === 'copying') for (const candidate of [path.join(root, 'legacy-original'), target]) {
			if (await exists(candidate) && sameFiles(await snapshot(candidate), receipt!.files)) { retained = candidate; break; }
		}
		if (retained) copySource = retained;
		else {
			if (await exists(target) || !options.ambiguous || !options.choose || await options.choose(true) !== 'fresh') throw new Error('browser_session_source_changed');
			await save({ ...receipt!, boot, phase: 'fresh', files: {} });
			await storage.mkdir(relative + '/session'); await checkSessionTree(target); return target;
		}
	}
	if (options.active(source) || receipt!.boot === boot && receipt!.phase === 'restart') throw new Error('browser_session_restart');
	if (receipt!.phase === 'restart') await save({ ...receipt!, boot, phase: 'copying', files: await snapshot(source) });
	if (receipt!.phase === 'copying') {
		if (!sameFiles(await snapshot(copySource), receipt!.files)) throw new Error('browser_session_source_changed');
		// Each explicitly selected vault owns its original bytes before any vault can retire the shared source.
		await copyVerified(copySource, path.join(root, 'legacy-original'), receipt!.files);
		if (await exists(target)) {
			if (!sameFiles(await snapshot(target), receipt!.files)) throw new Error('browser_session_source_changed');
		} else {
			const stage = path.join(root, 'session-copy');
			await copyVerified(copySource, stage, receipt!.files);
			await check(target); await rename(stage, target);
		}
		await save({ ...receipt!, boot, phase: 'published' });
	}
	if (!await exists(target)) throw new Error('browser_session_unclaimed');
	await checkSessionTree(target);
	if (receipt!.phase === 'published' && receipt!.verified && receipt!.boot !== boot) {
		const backup = path.join(root, 'legacy-original');
		if (!receipt!.retirement) await save({ ...receipt!, retirement: randomUUID() });
		await removeVerifiedSource(source, backup, receipt!.files, receipt!.retirement!);
		await save({ ...receipt!, phase: 'complete' });
		await removeEmptyClaim(source, receipt!.retirement);
	}
	return target;
}

/** A native Session must actually open at the owned path before a later boot can retire its source. */
export async function confirmSessionDirectory(vault: string, relative: string, boot: string): Promise<void> {
	const store = new JsonStore<Receipt | null>(nativeVaultStorage(vault), relative + '/migration.json', valid), receipt = await store.load(null);
	if (!receipt) throw new Error('browser_session_receipt_invalid');
	if (receipt.phase === 'published' || receipt.phase === 'fresh') {
		const confirmed = receipt.verified ? receipt : (await store.commit({ base: receipt, value: { ...receipt, verified: true, boot } }))!;
		// Both primary and recovery records must remember that this directory held a live session.
		await store.commit({ base: confirmed, value: confirmed });
	}
}

/** Explicit account deletion also retires the owned legacy credentials. Downloads are not site data. */
export async function clearSessionRecovery(options: SessionMigration): Promise<void> {
	const { vault, relative, source } = options;
	const root = await absoluteNandPath(vault, relative), storage = nativeVaultStorage(vault), file = relative + '/migration.json';
	const store = new JsonStore<Receipt | null>(storage, file, valid);
	let receipt = await store.load(null);
	if (!receipt) throw new Error('browser_session_receipt_invalid');
	if (receipt.phase === 'published') {
		if (!source || receipt.source !== digest(source)) throw new Error('browser_session_source_changed');
		if (options.active(source)) throw new Error('browser_session_restart');
		if (!receipt.retirement) receipt = (await store.commit({ base: receipt, value: { ...receipt, retirement: randomUUID() } }))!;
		await removeVerifiedSource(source, path.join(root, 'legacy-original'), receipt.files, receipt.retirement!);
		receipt = (await store.commit({ base: receipt, value: { ...receipt, phase: 'complete' } }))!;
	}
	if (!['complete', 'fresh'].includes(receipt.phase)) throw new Error('browser_session_restart');
	// A recovery record must not send a deleted account back into the copy/cleanup phase.
	await store.commit({ base: receipt, value: receipt });
	if (receipt.source === digest(source ?? '')) await removeEmptyClaim(source, receipt.retirement);
	const remove = async (directory: string): Promise<void> => {
		await check(directory);
		if (!await exists(directory)) return;
		for (const item of await readdir(directory, { withFileTypes: true })) {
			const child = path.join(directory, item.name); await check(child);
			if (item.isDirectory()) await remove(child);
			else if (item.isFile()) await unlink(child);
			else throw new Error('browser_session_unsafe_source');
		}
		await rmdir(directory);
	};
	await remove(path.join(root, 'legacy-original'));
	await remove(path.join(root, 'session-copy'));
}

/** Retain an inactive, explicitly owned legacy tree in the vault. No retained script is executed. */
export async function retainLegacyDirectory(vault: string, relative: string, source: string): Promise<string | undefined> {
	const target = await absoluteNandPath(vault, relative + '/files'), storage = nativeVaultStorage(vault), file = relative + '/migration.json';
	const store = new JsonStore<Receipt | null>(storage, file, valid);
	let receipt = await store.load(null);
	if (receipt?.phase === 'complete') {
		if (await exists(source)) throw new Error('browser_session_source_changed');
		await removeEmptyClaim(source, receipt.retirement);
		return target;
	}
	if (receipt && receipt.source !== digest(source)) throw new Error('browser_session_source_changed');
	if (!receipt && !await exists(source)) return undefined;
	if (!receipt && await exists(target)) throw new Error('browser_session_unclaimed');
	const save = async (value: Receipt) => { receipt = await saveReceipt(storage, file, store, receipt, value); };
	if (!receipt) await save({ version: 1, source: digest(source), origin: source, boot: 'inactive-files', phase: 'copying', files: await snapshot(source) });
	if (receipt!.phase === 'copying') {
		await copyVerified(source, target, receipt!.files);
		await save({ ...receipt!, phase: 'published' });
	}
	if (receipt!.phase !== 'published') throw new Error('browser_session_receipt_invalid');
	if (!receipt!.retirement) await save({ ...receipt!, retirement: randomUUID() });
	await removeVerifiedSource(source, target, receipt!.files, receipt!.retirement!);
	await save({ ...receipt!, phase: 'complete' });
	await removeEmptyClaim(source, receipt!.retirement);
	return target;
}
