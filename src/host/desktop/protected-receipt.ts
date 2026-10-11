import { bundledMain } from './electron-main';

/** A host-protected receipt, whose authenticity does not come from synchronized vault bytes. */
export interface ProtectedReceipt {
	seal(value: string): string;
	open(value: string): string;
}

const SOURCE = `const {safeStorage}=require('electron');
exports.available=()=>safeStorage.isEncryptionAvailable()&&(process.platform!=='linux'||safeStorage.getSelectedStorageBackend()!=='basic_text');
exports.seal=value=>safeStorage.encryptString(value).toString('base64');
exports.open=value=>safeStorage.decryptString(Buffer.from(value,'base64'));`;

/** Unsupported/unavailable host protection requires an online release check on every use. */
export function protectedReceipt(win: Window): ProtectedReceipt | undefined {
	try {
		const host = bundledMain<ProtectedReceipt & { available(): boolean }>(win, SOURCE);
		return host.available() ? host : undefined;
	} catch { return undefined; }
}
