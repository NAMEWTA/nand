import { JsonStore } from '../json-store';
import { nandPath } from './nand-paths';
import type { TextStorage } from './ports';
import { storageWriteQueue } from './write-queue';
import { threeWayMerge } from './three-way-merge';

export interface VaultDevice { id: string; label: string; fingerprint?: string; legacyBrowserVaultId?: string }
interface IdentityFile { version: 1; vaultId: string; salt: string; devices: Record<string, VaultDevice> }
export interface VaultIdentity { vaultId: string; deviceId: string; legacyBrowserVaultId?: string }
export interface IdentityOptions {
	/** Read-only host identity; only a vault-salted digest is persisted. */
	machineIdentity?: string;
	label: string;
	legacyDeviceId?: unknown;
	legacyBrowserVaultId?: unknown;
	chooseDevice(devices: readonly VaultDevice[]): Promise<string | { label: string }>;
}
export const validIdentityId = (value: unknown): value is string => typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function validFile(value: unknown): value is IdentityFile | null {
	return value === null || record(value) && value.version === 1 && validIdentityId(value.vaultId) && validIdentityId(value.salt) && record(value.devices)
		&& Object.entries(value.devices).every(([id, device]) => record(device) && validIdentityId(id) && device.id === id && typeof device.label === 'string'
			&& (device.fingerprint === undefined || typeof device.fingerprint === 'string' && /^[a-f\d]{64}$/.test(device.fingerprint))
			&& (device.legacyBrowserVaultId === undefined || validIdentityId(device.legacyBrowserVaultId)));
}

/** Copied vaults share the mapping, but a different host gets a different device identity. */
export function initializeVaultIdentity(storage: TextStorage, options: IdentityOptions): Promise<VaultIdentity> {
	return storageWriteQueue(storage).run('nand-vault-identity:init', async () => {
		const file = nandPath('config/identity.json');
		const existed = await storage.exists(file) || await storage.exists(file + '.backup');
		const store = new JsonStore<IdentityFile | null>(storage, file, validFile, (base, local, remote) => {
			if (base && remote && (base.vaultId !== remote.vaultId || base.salt !== remote.salt)) throw new Error('nand-storage.identity-replaced');
			return threeWayMerge(base, local, remote);
		});
		const base = await store.load(null);
		if (base === null && existed) throw new Error('nand-storage.identity-unrecoverable');
		const next = structuredClone(base ?? { version: 1, vaultId: crypto.randomUUID(), salt: crypto.randomUUID(), devices: {} } satisfies IdentityFile);
		let fingerprint: string | undefined;
		if (options.machineIdentity) {
			const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([next.salt, options.machineIdentity])));
			fingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
		}
		let device = fingerprint ? Object.values(next.devices).find(item => item.fingerprint === fingerprint) : undefined;
		if (!device) {
			const choice = fingerprint ? { label: options.label } : await options.chooseDevice(Object.values(next.devices));
			if (typeof choice === 'string') {
				device = next.devices[choice];
				if (!device) throw new Error('nand-storage.unknown-device');
			} else {
				const label = choice.label.trim().normalize('NFC');
				if (!label || [...label].length > 128 || [...label].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new Error('nand-storage.invalid-device-name');
				const legacy = options.legacyDeviceId;
				const id = validIdentityId(legacy) && !next.devices[legacy] ? legacy : crypto.randomUUID();
				device = { id, label, ...(fingerprint ? { fingerprint } : {}) };
				next.devices[id] = device;
			}
		}
		if (!device.legacyBrowserVaultId && validIdentityId(options.legacyBrowserVaultId)) device.legacyBrowserVaultId = options.legacyBrowserVaultId;
		let commitBase = base;
		if (base === null) {
			// Seed a missing store with the complete mapping so its first backup is recoverable.
			commitBase = await store.load(next);
			if (JSON.stringify(commitBase) !== JSON.stringify(next)) throw new Error('nand-storage.identity-replaced');
		}
		let persisted = JSON.stringify(base) !== JSON.stringify(next) ? await store.commit({ base: commitBase, value: next }) : next;
		// Before any module uses this identity, its backup must contain the selected device too.
		persisted = await store.commit({ base: persisted, value: persisted });
		const selected = persisted?.devices[device.id];
		if (!persisted || !selected) throw new Error('nand-storage.device-removed');
		return { vaultId: persisted.vaultId, deviceId: selected.id, ...(selected.legacyBrowserVaultId ? { legacyBrowserVaultId: selected.legacyBrowserVaultId } : {}) };
	});
}
