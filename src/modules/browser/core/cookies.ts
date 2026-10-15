export interface ImportCookie {
	domain: string;
	hostOnly?: boolean;
	name: string;
	value: string;
	path: string;
	secure: boolean;
	httpOnly: boolean;
	expirationDate?: number;
	sameSite: 'unspecified' | 'no_restriction' | 'lax' | 'strict';
}
export interface DetectedBrowser {
	family: string;
	label: string;
	root: string;
	kind: 'chromium' | 'firefox';
	keychainService?: string;
	keychainAccount?: string;
	profiles: Array<{ name: string; directory: string; cookiesPath: string }>;
}
export interface CookieImportResult {
	imported: number;
	skipped: number;
	googleSkipped: number;
	decryptFailed: number;
	warning?: 'app-bound-encryption' | 'linux-keyring-unavailable' | 'unknown';
	source: string;
}
