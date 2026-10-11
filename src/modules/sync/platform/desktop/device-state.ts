import { createHash } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { JsonStore } from '../../../../shared/json-store';
import { nandPath } from '../../../../shared/storage/nand-paths';
import type { TextStorage } from '../../../../shared/storage/ports';
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
export class SyncDeviceStore {
	private readonly stores = new Map<string, JsonStore<DeviceSyncState>>();
	constructor(private storage: TextStorage, private vaultRoot: string, private device: string) {}
	private store(cwd: string): JsonStore<DeviceSyncState> {
		const file = syncStatePath(this.vaultRoot, cwd, this.device);
		let store = this.stores.get(file);
		if (!store) { store = new JsonStore(this.storage, file, validState); this.stores.set(file, store); }
		return store;
	}
	async load(cwd: string, legacyPath: string): Promise<DeviceSyncState> {
		const file = syncStatePath(this.vaultRoot, cwd, this.device);
		let legacy: DeviceSyncState | undefined, legacyText: string | undefined;
		if (!await this.storage.exists(file) && !await this.storage.exists(file + '.backup')) {
			if (path.basename(legacyPath) !== 'nand-sync.json') throw new Error('nand-storage.invalid-legacy-state');
			try {
				legacyText = await readFile(legacyPath, 'utf8');
				const value: unknown = JSON.parse(legacyText);
				if (!validState(value)) throw new Error('nand-storage.invalid-sync-state');
				legacy = value;
			} catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
		}
		const store = this.store(cwd);
		let value = await store.load(legacy ?? EMPTY_DEVICE_STATE);
		if (legacy) {
			value = await store.commit({ base: value, value });
			// Never remove an old sidecar that changed while its verified copy was being created.
			if (await readFile(legacyPath, 'utf8') === legacyText) await unlink(legacyPath);
		}
		return value;
	}
	save(cwd: string, base: DeviceSyncState, value: DeviceSyncState): Promise<DeviceSyncState> {
		return this.store(cwd).commit({ base, value });
	}
}
