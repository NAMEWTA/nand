// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/web-precheck.ts
export function normalizeWebUrl(value: string): string {
	const s = value.trim();
	return s && !/^[a-z][a-z\d+.-]*:/i.test(s) ? `https://${s}` : s;
}
export function isValidWebUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
	} catch {
		return false;
	}
}
