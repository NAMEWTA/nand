import { createHash } from 'node:crypto';
import { readFile, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { JsonStore } from '../../../../shared/json-store';
import { nandPath } from '../../../../shared/storage/nand-paths';
import type { TextStorage } from '../../../../shared/storage/ports';
import { storageWriteQueue } from '../../../../shared/storage/write-queue';
import { EMPTY_DEVICE_STATE, type DeviceSyncState } from '../../core/ports';

export function syncStatePath(vaultRoot: string, cwd: string, device: string): string {
	const relative = path.relative(vaultRoot, cwd).replaceAll('\\', '/') || '.';
	if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) throw new Error('nand-storage.invalid-repository');
	const repository = createHash('sha256').update(relative).digest('hex');
	return nandPath('sync', device, repository + '.json');
}
function validState(value: unknown): value is DeviceSyncState {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const record = value as Record<string, unknown>;
	return ['lastCommit', 'lastPull', 'lastPush', 'failures'].every(key => typeof record[key] === 'number' && Number.isFinite(record[key]))
		&& ['', 'manual', 'failures'].includes(String(record.paused)) && Number.isInteger(record.failures) && Number(record.failures) >= 0;
}
interface Migration { version: 1; source: string; text: string; value: DeviceSyncState; stage: 'prepared' | 'copied' | 'complete' }
function validMigration(value: unknown): value is Migration | null {
	if (value === null) return true;
	if (!value || typeof value !== 'object') return false;
	const record = value as Record<string, unknown>;
	return record.version === 1 && typeof record.source === 'string' && typeof record.text === 'string'
		&& validState(record.value) && ['prepared', 'copied', 'complete'].includes(String(record.stage));
}
async function legacyText(file: string): Promise<string | undefined> {
	try { return await readFile(file, 'utf8'); }
	catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined; throw error; }
}
export class SyncDeviceStore {
	private readonly stores = new Map<string, JsonStore<DeviceSyncState>>();
	constructor(private storage: TextStorage, private vaultRoot: string, private device: string) {}
	private async file(cwd: string): Promise<string> {
		const [root, repository] = await Promise.all([realpath(this.vaultRoot), realpath(cwd)]);
		return syncStatePath(root, repository, this.device);
	}
	private store(file: string): JsonStore<DeviceSyncState> {
		let store = this.stores.get(file);
		if (!store) { store = new JsonStore(this.storage, file, validState); this.stores.set(file, store); }
		return store;
	}
	async load(cwd: string, legacyPath: string): Promise<DeviceSyncState> {
		const file = await this.file(cwd);
		return storageWriteQueue(this.storage).run('sync-migration:' + file, async () => {
			if (path.basename(legacyPath) !== 'nand-sync.json') throw new Error('nand-storage.invalid-legacy-state');
			const receipts = new JsonStore<Migration | null>(this.storage, nandPath('migrations', 'sync', this.device, path.basename(file)), validMigration);
			let receipt = await receipts.load(null);
			if (!receipt && !await this.storage.exists(file) && !await this.storage.exists(file + '.backup')) {
				const text = await legacyText(legacyPath);
				if (text !== undefined) {
					const value: unknown = JSON.parse(text);
					if (!validState(value)) throw new Error('nand-storage.invalid-sync-state');
					receipt = await receipts.commit({ base: null, value: { version: 1, source: legacyPath, text, value, stage: 'prepared' } });
				}
			}
			const store = this.store(file);
			let value = await store.load(receipt && receipt.stage !== 'complete' ? receipt.value : EMPTY_DEVICE_STATE);
			if (receipt && receipt.stage !== 'complete') {
				const source = await legacyText(legacyPath);
				if (receipt.source !== legacyPath || source !== receipt.text && !(source === undefined && receipt.stage === 'copied')) throw new Error('nand-storage.migration-source-changed');
				if (JSON.stringify(value) !== JSON.stringify(receipt.value)) throw new Error('nand-storage.migration-target-changed');
				// Repair an interrupted primary write before permitting source cleanup.
				value = await store.commit({ base: value, value });
				receipt = (await receipts.commit({ base: receipt, value: { ...receipt, stage: 'copied' } }))!;
				const latest = await legacyText(legacyPath);
				if (latest !== undefined) {
					if (latest !== receipt.text) throw new Error('nand-storage.migration-source-changed');
					await unlink(legacyPath);
				}
				await receipts.commit({ base: receipt, value: { ...receipt, stage: 'complete' } });
			}
			return value;
		});
	}
	async save(cwd: string, base: DeviceSyncState, value: DeviceSyncState): Promise<DeviceSyncState> {
		const file = await this.file(cwd);
		return storageWriteQueue(this.storage).run('sync-migration:' + file, () => this.store(file).commit({ base, value }));
	}
}
