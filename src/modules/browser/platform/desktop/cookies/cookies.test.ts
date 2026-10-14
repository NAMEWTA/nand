import { describe, expect, it } from 'vitest';
import { createCipheriv, createHash, pbkdf2Sync } from 'node:crypto';
import { parseCookieFile } from './file-formats';
import { decryptCookieValueRaw } from './decrypt';
import { domainIsInImportedScope, isNonTransplantableCookieDomain, normalizeCookieDomain } from './policy';
import { chromiumTime } from './import';
describe('Cookie import', () => {
	it('reads Netscape including comments and HttpOnly', () => {
		const result = parseCookieFile(
			'# Netscape HTTP Cookie File\n# comment\n#HttpOnly_.example.com\tTRUE\t/\tTRUE\t1800000000\tsid\tlogged-in\nlocalhost\tFALSE\t/\tFALSE\t0\ta\tb',
		);
		expect(result.cookies).toHaveLength(2);
		expect(result.cookies[0]).toMatchObject({
			domain: '.example.com',
			name: 'sid',
			value: 'logged-in',
			httpOnly: true,
			secure: true,
		});
	});
	it('reads JSON exports and counts invalid rows', () => {
		const result = parseCookieFile(
			JSON.stringify([
				{ domain: '.example.com', name: 'sid', value: 'ok', sameSite: 'none', expirationDate: 1800000000 },
				{ domain: 'evil/path', name: 'x', value: 'v' },
			]),
		);
		expect(result.skipped).toBe(1);
		expect(result.cookies[0]?.sameSite).toBe('no_restriction');
	});
	it('excludes only google.com and validates domains', () => {
		for (const d of ['google.com', '.accounts.google.com']) expect(isNonTransplantableCookieDomain(d)).toBe(true);
		expect(isNonTransplantableCookieDomain('notgoogle.com')).toBe(false);
		for (const d of ['a/b', 'a@b', 'a..b', '-bad.com', 'a.com:88']) expect(normalizeCookieDomain(d)).toBeNull();
		expect(domainIsInImportedScope(['a.example.com'], 'b.example.com')).toBe(false);
		expect(domainIsInImportedScope(['a.example.com'], 'sub.a.example.com')).toBe(true);
	});
	it.each(['v10', 'v11'] as const)('decrypts %s, strips SHA256 and rejects wrong keys', (version) => {
		const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1');
		const cipher = createCipheriv('aes-128-cbc', key, Buffer.alloc(16, ' '));
		const raw = Buffer.concat([createHash('sha256').update('.example.com').digest(), Buffer.from('value')]);
		const encrypted = Buffer.concat([Buffer.from(version), cipher.update(raw), cipher.final()]);
		expect(
			decryptCookieValueRaw(
				encrypted,
				{ mode: 'aes-128-cbc', keysByVersion: { [version]: key } },
				'.example.com',
			)?.toString(),
		).toBe('value');
		expect(
			decryptCookieValueRaw(
				encrypted,
				{ mode: 'aes-128-cbc', keysByVersion: { [version]: Buffer.alloc(16) } },
				'.example.com',
			),
		).toBeNull();
	});
	it('decrypts GCM, rejects app-bound and bad tags', () => {
		const key = Buffer.alloc(32, 2),
			nonce = Buffer.alloc(12, 3),
			cipher = createCipheriv('aes-256-gcm', key, nonce);
		const encrypted = Buffer.concat([
			Buffer.from('v10'),
			nonce,
			cipher.update('hello'),
			cipher.final(),
			cipher.getAuthTag(),
		]);
		expect(decryptCookieValueRaw(encrypted, { mode: 'aes-256-gcm', key }, 'example.com')?.toString()).toBe('hello');
		encrypted[encrypted.length - 1] = encrypted[encrypted.length - 1]! ^ 1;
		expect(decryptCookieValueRaw(encrypted, { mode: 'aes-256-gcm', key }, 'example.com')).toBeNull();
		encrypted.write('v20');
		expect(decryptCookieValueRaw(encrypted, { mode: 'aes-256-gcm', key }, 'example.com')).toBeNull();
	});
	it('converts Chromium timestamps without unsafe intermediate numbers', () => {
		expect(chromiumTime('13390000000000001')).toBe(1745526400);
	});
});
