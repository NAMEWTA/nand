import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';
import { SESSION_RUNTIME_SOURCE } from './browser-session';

test('bundled main policy attaches explicit sessions, constrains downloads and guards the final asynchronous guest teardown', () => {
	const root = mkdtempSync(path.join(tmpdir(), 'nand-native-session-')), directory = path.join(root, '.nand/browser/profile/session'), downloads = path.join(root, '.nand/browser/profile/downloads');
	mkdirSync(directory, { recursive: true }); mkdirSync(downloads);
	const session = Object.assign(new EventEmitter(), { storagePath: directory, setCodeCachePath: (_path: string) => {}, setPermissionRequestHandler: (_fn: unknown) => {}, setPermissionCheckHandler: (_fn: unknown) => {} });
	const owner = Object.assign(new EventEmitter(), { id: 1, isDestroyed: () => false, session: {} });
	let destroyed = false, handler: () => { action: string } = () => ({ action: '' });
	const guest = Object.assign(new EventEmitter(), { id: 2, session, isDestroyed: () => destroyed, setWindowOpenHandler: (fn: typeof handler) => { handler = fn; } });
	const nativeRequire = createRequire(process.cwd() + '/package.json');
	const exported: { acquire?: (vault: string, directory: string, downloads: string) => { session: unknown; bind(owner: number, token: string): void; protect(id: number): void; dispose(): void } } = {};
	runInNewContext(SESSION_RUNTIME_SOURCE, { exports: exported, require: (name: string) => name === 'electron' ? { session: { fromPath: (file: string) => { expect(file).toBe(directory); return session; } }, webContents: { fromId: (id: number) => id === 1 ? owner : guest, getAllWebContents: () => [owner, guest] } } : nativeRequire(name), URL });
	try {
		const first = exported.acquire!(root, directory, downloads), second = exported.acquire!(root, directory, downloads);
		first.bind(1, 'routing-only');
		const prefs: Record<string, unknown> = { partition: 'routing-only', nodeIntegration: true, preload: 'unsafe' };
		owner.emit('will-attach-webview', {}, prefs, { partition: 'routing-only' });
		expect(prefs.session).toBe(session); expect(prefs.partition).toBeUndefined(); expect(prefs.preload).toBeUndefined(); expect(prefs.nodeIntegration).toBe(false);
		first.protect(2); expect(handler().action).toBe('deny');
		let denied = false;
		guest.emit('will-navigate', { preventDefault: () => { denied = true; } }, 'file:///outside'); expect(denied).toBe(true);
		let saved = '', cancelled = false;
		const event = { preventDefault: () => { cancelled = true; } }, item = { getFilename: () => '../../outside.txt', setSavePath: (file: string) => { saved = file; }, cancel: () => { cancelled = true; } };
		session.emit('will-download', event, item); expect(path.dirname(saved)).toBe(downloads); expect(cancelled).toBe(false);
		first.dispose(); expect(owner.listenerCount('will-attach-webview')).toBe(0); expect(session.listenerCount('will-download')).toBe(1);
		second.dispose(); expect(session.listenerCount('will-download')).toBe(1);
		session.emit('will-download', event, item); expect(cancelled).toBe(true);
		destroyed = true; guest.emit('destroyed'); expect(session.listenerCount('will-download')).toBe(0); expect(guest.listenerCount('will-navigate')).toBe(0);
		expect(() => exported.acquire!(root, path.join(root, 'outside'), downloads)).toThrow('browser_session_path');
		symlinkSync(downloads, path.join(root, '.nand/linked'), 'junction');
		expect(() => exported.acquire!(root, path.join(root, '.nand/linked'), downloads)).toThrow('symlink');
	} finally { rmSync(root, { recursive: true, force: true }); }
});
