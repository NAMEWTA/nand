import { expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { acquireVaultSession, type VaultSessionLease } from '../../../../host/desktop/browser-session';
import { bundledMain, desktopRemote } from '../../../../host/desktop/electron-main';
import { prepareBrowserSession } from './prepared-session';
vi.mock('../../../../host/desktop/browser-session', () => ({
	acquireVaultSession: vi.fn(),
	SESSION_RUNTIME_SOURCE: 'native runtime',
}));
vi.mock('../../../../host/desktop/electron-main', () => ({ bundledMain: vi.fn(), desktopRemote: vi.fn() }));
it('prepares once and gives each window independently released native bindings', async () => {
	const broker = { closed: false } as Window,
		owner = { closed: false, electronWindow: { webContents: { id: 2 } } } as unknown as Window;
	const prepared = {
		storagePath: '/vault/.nand/browser/device/profiles/default/session',
		dispose: vi.fn(),
		clearRecovery: vi.fn(async () => {}),
	};
	vi.mocked(acquireVaultSession).mockResolvedValue(prepared as unknown as VaultSessionLease);
	const bindings: Array<{ bind: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }> = [];
	const acquire = vi.fn(() => {
		const native = { bind: vi.fn(), dispose: vi.fn(), protect: vi.fn(), onDownloadError: vi.fn(), session: {} };
		bindings.push(native);
		return native;
	});
	vi.mocked(bundledMain).mockReturnValue({ acquire });
	vi.mocked(desktopRemote).mockImplementation(
		(win) =>
			({ getCurrentWebContents: () => ({ id: win === broker ? 1 : 2 }) }) as ReturnType<typeof desktopRemote>,
	);
	const app = { vault: { adapter: { getBasePath: () => '/vault' } } } as unknown as App;
	const session = await prepareBrowserSession(app, broker, 'default', new AbortController().signal);
	const one = session.acquire(broker),
		two = session.acquire(owner);
	const first = { setAttribute: vi.fn() },
		second = { setAttribute: vi.fn() };
	one.bind(first as unknown as HTMLElement);
	two.bind(second as unknown as HTMLElement);
	expect(bindings[0]!.bind.mock.calls.map((c) => c[0])).toEqual([1]);
	expect(bindings[1]!.bind.mock.calls.map((c) => c[0])).toEqual([2, 1]);
	expect(first.setAttribute.mock.calls[0]![1]).not.toBe(second.setAttribute.mock.calls[0]![1]);
	one.dispose();
	expect(bindings[0]!.dispose).toHaveBeenCalledOnce();
	expect(bindings[1]!.dispose).not.toHaveBeenCalled();
	expect(acquireVaultSession).toHaveBeenCalledOnce();
	expect(acquire).toHaveBeenCalledTimes(2);
	await two.clearRecovery();
	expect(prepared.clearRecovery).toHaveBeenCalledOnce();
	two.dispose();
	session.dispose();
	session.dispose();
	expect(prepared.dispose).toHaveBeenCalledOnce();
	expect(() => session.acquire(owner)).toThrow('browser_session_closed');
});
