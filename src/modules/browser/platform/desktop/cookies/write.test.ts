import { describe, it, expect } from 'vitest';
import vm from 'node:vm';
import { COOKIE_SESSION_SOURCE } from './write';
import type { ImportCookie } from '../../../core/cookies';
const cookie = (domain: string, name = 'old', value = 'before'): ImportCookie => ({
	domain,
	name,
	value,
	path: '/',
	secure: false,
	httpOnly: false,
	sameSite: 'lax',
});
function fixture(rows: ImportCookie[], fail: 'target' | 'staging' | undefined = undefined) {
	let stored = structuredClone(rows),
		flush = 0;
	const target = {
		cookies: {
			get: async () => structuredClone(stored),
			// Electron remove matches URL scope, including parent domains and path prefixes.
			remove: async (url: string, name: string) => {
				const { hostname, pathname } = new URL(url);
				stored = stored.filter(
					(c) =>
						!(
							c.name === name &&
							(hostname === c.domain.replace(/^\./, '') ||
								(!c.hostOnly &&
									hostname.endsWith(c.domain.startsWith('.') ? c.domain : '.' + c.domain))) &&
							(pathname === c.path || pathname.startsWith(c.path.endsWith('/') ? c.path : c.path + '/'))
						),
				);
			},
			set: async (c: ImportCookie & { url: string }) => {
				if (fail === 'target' && c.value === 'after') throw Error('disk');
				const domain = c.domain || new URL(c.url).hostname;
				const hostOnly = !c.domain;
				const key = (d: ImportCookie) => [d.domain.replace(/^\./, ''), !!d.hostOnly, d.name, d.path].join('|');
				const next = { ...c, domain, hostOnly };
				stored = stored.filter((d) => key(d) !== key(next));
				if (!c.expirationDate || c.expirationDate > Date.now() / 1000) stored.push(next);
			},
			flushStore: async () => {
				flush++;
			},
		},
	};
	const staging = {
		cookies: {
			set: async () => {
				if (fail === 'staging') throw Error('invalid');
			},
		},
		clearStorageData: async () => {},
	};
	const exports = {} as {
		write: (path: string, rows: ImportCookie[]) => Promise<{ imported: number; failed: number }>;
	};
	vm.runInNewContext(COOKIE_SESSION_SOURCE, {
		exports,
		URL,
		require: (name: string) =>
			name === 'electron'
				? { session: { fromPath: () => target, fromPartition: () => staging } }
				: { randomUUID: () => 'fixture' },
	});
	return {
		write: (rows: ImportCookie[]) => exports.write('/private/session', rows),
		stored: () => stored,
		flush: () => flush,
	};
}
describe('Cookie replacement transaction', () => {
	it('replaces only exact imported domains while retaining unrelated and Google cookies', async () => {
		const f = fixture([
			cookie('.example.com'),
			cookie('sub.example.com'),
			cookie('other.com'),
			cookie('.google.com'),
		]);
		expect(await f.write([cookie('.example.com', 'sid', 'after')])).toEqual({ imported: 1, failed: 0 });
		expect(f.stored().map((c) => c.domain)).toEqual([
			'sub.example.com',
			'other.com',
			'.google.com',
			'.example.com',
		]);
		expect(f.flush()).toBe(1);
	});
	it('preserves parent, sibling and descendant cookies with matching names and paths', async () => {
		const outside = [
			cookie('.example.com', 'same'),
			cookie('b.example.com', 'same'),
			cookie('deep.a.example.com', 'same'),
			{ ...cookie('.example.com', 'same'), path: '/private' },
		];
		const f = fixture([
			...outside,
			{ ...cookie('a.example.com', 'same'), hostOnly: true },
			{ ...cookie('a.example.com', 'same'), hostOnly: true, path: '/private' },
			cookie('.a.example.com', 'same'),
		]);
		await f.write([{ ...cookie('a.example.com', 'new', 'after'), hostOnly: true }]);
		expect(f.stored().slice(0, outside.length)).toEqual(outside);
		expect(f.stored().map((c) => c.name)).toEqual(['same', 'same', 'same', 'same', 'new']);
	});
	it('restores host-only and domain cookies at every path without touching the parent on rollback', async () => {
		const before = [
			cookie('.example.com', 'same'),
			{ ...cookie('a.example.com', 'same'), hostOnly: true },
			{ ...cookie('a.example.com', 'same'), hostOnly: true, path: '/private' },
			cookie('.a.example.com', 'same'),
		];
		const f = fixture(before, 'target');
		await expect(f.write([{ ...cookie('a.example.com', 'sid', 'after'), hostOnly: true }])).rejects.toThrow(
			'No Cookies',
		);
		const identities = (rows: ImportCookie[]) =>
			rows.map((c) => [c.domain, !!c.hostOnly, c.path, c.name, c.value]).sort();
		expect(identities(f.stored())).toEqual(identities(before));
	});
	it('does not alter the target when every candidate fails validation', async () => {
		const before = [cookie('.example.com')],
			f = fixture(before, 'staging');
		expect(await f.write([cookie('.example.com', 'sid', 'after')])).toEqual({ imported: 0, failed: 1 });
		expect(f.stored()).toEqual(before);
		expect(f.flush()).toBe(0);
	});
	it('rolls back previous cookies after a complete target write failure', async () => {
		const f = fixture([cookie('.example.com'), cookie('other.com')], 'target');
		await expect(f.write([cookie('.example.com', 'sid', 'after')])).rejects.toThrow('No Cookies');
		expect(
			f
				.stored()
				.map((c) => [c.domain, c.name, c.value])
				.sort(),
		).toEqual([
			['.example.com', 'old', 'before'],
			['other.com', 'old', 'before'],
		]);
		expect(f.flush()).toBe(1);
	});
});
