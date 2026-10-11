import type { TextStorage } from './ports';
import { JsonStore } from '../json-store';
import { contentPath, isContentPath } from './content-paths';
import { nandPath } from './nand-paths';
import { ensureDirectory } from './durable-state';
import { storageWriteQueue } from './write-queue';

export interface ContentMigrationPort extends TextStorage {
	readBinary(path: string): Promise<ArrayBuffer>;
	/** Exclusive copy: never overwrite an existing destination. */
	copy(source: string, target: string): Promise<void>;
	move(source: string, target: string): Promise<void>;
}

interface Manifest {
	version: 1;
	stage: 'prepared' | 'copied' | 'complete';
	files: Array<{ source: string; hash: string }>;
}
export const CONTENT_MIGRATION_FILE = nandPath('migrations/content/manifest.json');
function validManifest(value: unknown): value is Manifest | null {
	if (value === null) return true;
	if (!value || typeof value !== 'object') return false;
	const record = value as Record<string, unknown>;
	const destinations = new Set<string>();
	return record.version === 1 && ['prepared', 'copied', 'complete'].includes(String(record.stage)) && Array.isArray(record.files)
		&& record.files.every((file: unknown) => {
			if (!file || typeof file !== 'object') return false;
			const item = file as Record<string, unknown>;
			if (typeof item.source !== 'string' || !item.source || isContentPath(item.source) || typeof item.hash !== 'string' || !/^[a-f\d]{64}$/.test(item.hash)) return false;
			try {
				const destination = contentPath(item.source).normalize('NFC').toLowerCase();
				if (destinations.has(destination)) return false;
				destinations.add(destination); return true;
			} catch { return false; }
		});
}
async function digest(storage: ContentMigrationPort, path: string): Promise<string> {
	const bytes = await storage.readBinary(path);
	const hash = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Only established NAND ownership enters here; an interrupted move keeps both verified copies. */
export function migrateContent(storage: ContentMigrationPort, sources: readonly string[]): Promise<void> {
	return storageWriteQueue(storage).run('nand-content:migration', async () => {
		const store = new JsonStore<Manifest | null>(storage, CONTENT_MIGRATION_FILE, validManifest);
		let manifest = await store.load(null);
		if (!manifest) {
			const files: Manifest['files'] = [];
			const names = new Set<string>();
			for (const source of [...new Set(sources)]) {
				if (isContentPath(source)) continue;
				const target = contentPath(source);
				const name = target.normalize('NFC').toLowerCase();
				if (names.has(name)) throw new Error('nand-content.migration-name-conflict');
				names.add(name);
				files.push({ source, hash: await digest(storage, source) });
			}
			const candidate: Manifest = { version: 1, stage: 'prepared', files };
			const base = await store.load(candidate);
			if (JSON.stringify(base) !== JSON.stringify(candidate)) throw new Error('nand-content.migration-replaced');
			manifest = (await store.commit({ base, value: candidate }))!;
		}
		for (const { source, hash } of manifest.files) {
			if (!source || isContentPath(source)) throw new Error('nand-content.invalid-migration');
			const target = contentPath(source);
			if (manifest.stage === 'complete') continue;
			if (!await storage.exists(target)) {
				const origin = manifest.stage === 'copied' && !await storage.exists(source) ? nandPath('migrations/content/originals', source) : source;
				if (await digest(storage, origin) !== hash) throw new Error(`nand-content.migration-source-changed: ${origin}`);
				await ensureDirectory(storage, target.slice(0, target.lastIndexOf('/')));
				await storage.copy(origin, target);
			}
			if (await digest(storage, target) !== hash) throw new Error(`nand-content.migration-target-changed: ${target}`);
		}
		if (manifest.stage === 'prepared') manifest = (await store.commit({ base: manifest, value: { ...manifest, stage: 'copied' } }))!;
		for (const { source, hash } of manifest.files) {
			const target = contentPath(source);
			if (manifest.stage !== 'complete' && await digest(storage, target) !== hash) throw new Error(`nand-content.migration-target-changed: ${target}`);
			const retained = nandPath('migrations/content/originals', source);
			if (await storage.exists(source)) {
				if (manifest.stage === 'complete' || await storage.exists(retained) || await digest(storage, source) !== hash) throw new Error(`nand-content.migration-source-changed: ${source}`);
				await ensureDirectory(storage, retained.slice(0, retained.lastIndexOf('/')));
				await storage.move(source, retained);
			}
			if (await storage.exists(source) || !await storage.exists(retained) || await digest(storage, retained) !== hash) throw new Error(`nand-content.migration-source-changed: ${retained}`);
		}
		if (manifest.stage !== 'complete') await store.commit({ base: manifest, value: { ...manifest, stage: 'complete' } });
	});
}
