import { promises as fs } from 'node:fs';
import type { NativeHelperSqlite } from '../../../../agent/api';
import type { CookieImportResult, DetectedBrowser, ImportCookie } from '../../../core/cookies';
import { getEncryptionKey } from './keys';
import { decryptCookieValueRaw, cookieEncryptionVersion } from './decrypt';
import { readCookieRows } from './read';
import { validateCookie } from './validate';
import { isNonTransplantableCookieDomain } from './policy';
import { parseCookieFile } from './file-formats';
import { cookieSession } from './write';
export function chromiumTime(value: string): number {
	return Number(BigInt(value) / 1000000n - 11644473600n);
}
async function write(
	win: Window,
	directory: string,
	cookies: ImportCookie[],
	result: CookieImportResult,
): Promise<CookieImportResult> {
	const allowed = cookies.filter((c) => {
		if (isNonTransplantableCookieDomain(c.domain)) {
			result.googleSkipped++;
			return false;
		}
		return true;
	});
	if (allowed.length) {
		const applied = await cookieSession(win).write(directory, allowed);
		result.imported = applied.imported;
		result.skipped += applied.failed;
	}
	return result;
}
export async function importCookieFile(win: Window, path: string, directory: string): Promise<CookieImportResult> {
	if ((await fs.stat(path)).size > 32 * 1024 * 1024) throw new Error('Cookie file exceeds 32 MiB');
	const parsed = parseCookieFile(await fs.readFile(path, 'utf8'));
	return write(win, directory, parsed.cookies, {
		imported: 0,
		skipped: parsed.skipped,
		googleSkipped: 0,
		decryptFailed: 0,
		source: 'file',
	});
}
export async function importBrowserCookies(
	win: Window,
	browser: DetectedBrowser,
	profileDir: string | undefined,
	directory: string,
	tmp: string,
	helper: NativeHelperSqlite,
	signal?: AbortSignal,
): Promise<CookieImportResult> {
	const profile =
		browser.profiles.find((p) => p.directory === profileDir) ?? (!profileDir ? browser.profiles[0] : undefined);
	if (!profile) throw new Error('Browser profile not found');
	const rows = await readCookieRows(profile.cookiesPath, browser.kind, tmp, helper, signal);
	const key = browser.kind === 'chromium' ? await getEncryptionKey(browser) : null;
	const result: CookieImportResult = {
		imported: 0,
		skipped: 0,
		googleSkipped: 0,
		decryptFailed: 0,
		source: `${browser.label} (${profile.name})`,
	};
	const cookies: ImportCookie[] = [];
	for (const row of rows) {
		const domain = typeof row.host_key === 'string' ? row.host_key : '';
		if (isNonTransplantableCookieDomain(domain)) {
			result.googleSkipped++;
			continue;
		}
		let value = typeof row.value === 'string' ? row.value : '';
		if (typeof row.encrypted_value_hex === 'string' && row.encrypted_value_hex) {
			const encrypted = Buffer.from(row.encrypted_value_hex, 'hex');
			const plain = key ? decryptCookieValueRaw(encrypted, key, domain) : null;
			if (plain === null) {
				result.decryptFailed++;
				result.warning =
					cookieEncryptionVersion(encrypted) === 'v20'
						? 'app-bound-encryption'
						: key?.mode === 'aes-128-cbc' && key.keyringUnavailable
							? 'linux-keyring-unavailable'
							: 'unknown';
				continue;
			}
			value = plain.toString('utf8');
		}
		const cookie = validateCookie({
			domain,
			name: row.name,
			value,
			path: row.path,
			secure: row.is_secure === 1,
			httpOnly: row.is_httponly === 1,
			expirationDate:
				browser.kind === 'firefox'
					? Number(row.expiry)
					: chromiumTime(typeof row.expires_utc === 'string' ? row.expires_utc : '0'),
			sameSite:
				row.samesite === 1
					? 'lax'
					: row.samesite === 2
						? 'strict'
						: row.samesite === 0
							? 'no_restriction'
							: 'unspecified',
		});
		if (cookie) cookies.push(cookie);
		else result.skipped++;
	}
	if (signal?.aborted) throw new Error('Cookie import cancelled');
	return write(win, directory, cookies, result);
}
