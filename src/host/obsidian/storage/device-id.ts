import { Platform, type App } from 'obsidian';
import { initializeVaultIdentity, type VaultDevice, type VaultIdentity } from '../../../shared/storage/vault-identity';
import { privateVaultStorage } from './private-storage';

const identities = new WeakMap<App, VaultIdentity>();
const initializing = new WeakMap<App, Promise<VaultIdentity>>();
export interface DeviceInitialization {
	machineIdentity(): Promise<string | undefined>;
	label: string;
	chooseDevice(devices: readonly VaultDevice[]): Promise<string | { label: string }>;
}
/** Initialization precedes modules; identities are persisted only in the current vault. */
export function initializeDevice(app: App, options: DeviceInitialization): Promise<VaultIdentity> {
	const current = initializing.get(app);
	if (current) return current;
	const operation = (async () => {
		const identity = await initializeVaultIdentity(privateVaultStorage(app), {
			machineIdentity: await options.machineIdentity(), label: options.label, chooseDevice: devices => options.chooseDevice(devices),
			legacyDeviceId: app.loadLocalStorage('nand.device-id'), legacyBrowserVaultId: app.loadLocalStorage('nand.browser.vault-id'),
		});
		identities.set(app, identity);
		// Remove legacy keys only after the vault copy has been verified.
		app.saveLocalStorage('nand.device-id', null);
		app.saveLocalStorage('nand.browser.vault-id', null);
		return identity;
	})();
	initializing.set(app, operation);
	void operation.catch(() => { if (initializing.get(app) === operation) initializing.delete(app); });
	return operation;
}
export async function desktopMachineIdentity(): Promise<string | undefined> {
	return Platform.isDesktopApp ? (await import('../../desktop/device-identity')).machineIdentity() : undefined;
}
export function vaultIdentity(app: App): VaultIdentity {
	const identity = identities.get(app);
	if (!identity) throw new Error('nand-storage.device-not-initialized');
	return identity;
}
export function deviceId(app: App): string {
	return vaultIdentity(app).deviceId;
}
