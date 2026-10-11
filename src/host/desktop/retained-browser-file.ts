import path from 'node:path';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { JsonStore } from '../../shared/json-store';
import { nativeVaultStorage } from './vault-storage';
import { absoluteNandPath } from './nand-paths';

interface Receipt { source: string; origin?: string; phase: string; files: Record<string, string> }
function valid(value: unknown): value is Receipt | null {
	if (value === null) return true;
	const row = value as Partial<Receipt>;
	return !!row && typeof row.source === 'string' && (row.origin === undefined || typeof row.origin === 'string') && typeof row.phase === 'string' && !!row.files && typeof row.files === 'object' && !Array.isArray(row.files);
}
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

/** Resolve old printed paths through a retained receipt; never trust a synchronized redirect alone. */
export async function retainedBrowserFile(vault: string, original: string): Promise<string | undefined> {
	if (!path.isAbsolute(original)) return undefined;
	const root = await absoluteNandPath(vault, '.nand/browser');
	let devices;
	try { devices = await readdir(root, { withFileTypes: true }); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
	let match: string | undefined;
	for (const device of devices) {
		if (!device.isDirectory() || device.isSymbolicLink()) continue;
		const relative = `.nand/browser/${device.name}/legacy-runtime`, storage = nativeVaultStorage(vault);
		const receipt = await new JsonStore<Receipt | null>(storage, relative + '/migration.json', valid).load(null);
		if (receipt?.phase !== 'complete' || !receipt.origin || hash(receipt.origin) !== receipt.source) continue;
		const tail = path.relative(receipt.origin, original).split(path.sep).join('/');
		if (!tail || tail === '..' || tail.startsWith('../') || path.isAbsolute(tail) || !Object.hasOwn(receipt.files, tail)) continue;
		const target = await absoluteNandPath(vault, relative + '/files/' + tail);
		if (hash(await readFile(target)) !== receipt.files[tail] || match && match !== target) throw new Error('browser_session_source_changed');
		match = target;
	}
	return match;
}
