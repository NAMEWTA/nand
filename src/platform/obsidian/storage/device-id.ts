import type { App } from 'obsidian';
/** Only the device identity belongs to host-local storage; Vault data lives under .nand. */
export function deviceId(app: App): string {
	const saved: unknown = app.loadLocalStorage('nand.device-id');
	if (typeof saved === 'string' && /^[a-z\d-]{36}$/.test(saved)) return saved;
	const id = crypto.randomUUID();
	app.saveLocalStorage('nand.device-id', id);
	return id;
}
