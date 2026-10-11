import { expect, test, vi } from 'vitest';
import { musicVaultFixture } from '../../../../../scripts/music-vault-fixture';
import { localSession, setCookies } from '../../../../../scripts/music-electron-stub';
import { NeteaseAccount } from './netease-account';

const pause = vi.hoisted(() => ({ enter: undefined as (() => void) | undefined, wait: undefined as Promise<void> | undefined }));
vi.mock('node:fs/promises', async original => {
	const fs = await original<typeof import('node:fs/promises')>();
	return { ...fs, mkdir: async (...args: Parameters<typeof fs.mkdir>) => {
		if (pause.enter && String(args[0]).endsWith('downloads')) { const enter = pause.enter; pause.enter = undefined; enter(); await pause.wait; }
		return fs.mkdir(...args);
	} };
});

test('destroy while the owned download directory is pending cannot attach a late session lease', async () => {
	const fixture = await musicVaultFixture(), account = new NeteaseAccount(fixture.app);
	let entered!: () => void, resume!: () => void;
	const started = new Promise<void>(resolve => { entered = resolve; }); pause.wait = new Promise<void>(resolve => { resume = resolve; }); pause.enter = entered;
	try {
		setCookies([{ name: 'MUSIC_U', value: 'fixture' }]);
		const restoring = account.restore(); await started; account.destroy(); resume(); await restoring;
		expect(account.loggedIn).toBe(false); expect(localSession.listenerCount('will-download')).toBe(0);
	} finally { resume(); pause.enter = undefined; pause.wait = undefined; account.destroy(); await fixture.dispose(); }
});

test('destroy during the native cookie read cannot publish a late logged-in state', async () => {
	const fixture = await musicVaultFixture(), account = new NeteaseAccount(fixture.app), get = localSession.cookies.get;
	let entered!: () => void, resume!: () => void;
	const started = new Promise<void>(resolve => { entered = resolve; }), pending = new Promise<void>(resolve => { resume = resolve; });
	localSession.cookies.get = async () => { entered(); await pending; return [{ name: 'MUSIC_U', value: 'fixture' }]; };
	try {
		const restoring = account.restore(); await started; account.destroy(); resume(); await restoring;
		expect(account.loggedIn).toBe(false); expect(localSession.listenerCount('will-download')).toBe(0);
	} finally { resume(); localSession.cookies.get = get; account.destroy(); await fixture.dispose(); }
});
