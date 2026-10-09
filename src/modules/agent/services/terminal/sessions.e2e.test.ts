import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'vitest';
import { normalizeTerminalSettings } from '../../core/terminal/settings';
import { TerminalSessions } from './sessions';
import type { TerminalSession } from './session';

// Built by `cargo build` in native/pty-server; CI builds it before running the tests.
const binary = ['release', 'debug'].map((profile) => `native/pty-server/target/${profile}/nand-pty`).find((file) => existsSync(file));

function manager() {
	const win = globalThis as unknown as Window;
	return new TerminalSessions({
		app: { workspace: { containerEl: { win } } } as never,
		pluginDir: () => '',
		version: 'test',
		platform: process.platform,
		settings: () => normalizeTerminalSettings({}),
		colors: () => ({ foreground: '#ffffff', background: '#000000', cursor: '#ffffff' }),
		binary: () => Promise.resolve(binary!),
	});
}

function until(session: TerminalSession, predicate: (text: string) => boolean, timeout = 10_000): Promise<string> {
	return new Promise((resolve, reject) => {
		let text = '';
		const timer = setTimeout(() => reject(new Error(`timed out: ${JSON.stringify(text.slice(-200))}`)), timeout);
		const off = session.subscribe((chunk) => {
			text += chunk;
			if (predicate(text)) {
				clearTimeout(timer);
				off();
				resolve(text);
			}
		});
	});
}

test.skipIf(!binary || process.platform === 'win32')('sessions run on the real helper: output, input, resize, exit and history errors', async () => {
	const sessions = manager();
	try {
		const session = await sessions.create({ kind: 'shell', title: 'sh', file: '/bin/sh', args: ['-c', 'printf "ready "; read line; stty size; echo "got:$line:$NAND_SESSION_ID"; exit 4'], cwd: process.cwd() });
		assert.equal(session.connection, 'connected');
		await until(session, (text) => text.includes('ready'));
		session.resize(100, 30);
		session.input('hello\r');
		const text = await until(session, (output) => output.includes('got:hello:'));
		assert.match(text, /30 100/);
		assert.ok(text.includes(`got:hello:${session.id}`));
		await new Promise<void>((resolve) => {
			const check = () => (session.connection === 'exited' ? resolve() : setTimeout(check, 20));
			check();
		});
		assert.equal(session.exitCode, 4);
		const missing = await sessions.create({ kind: 'shell', title: 'missing', file: '/nand/no/such/program', args: [], cwd: process.cwd() });
		assert.equal(missing.connection, 'failed');
		await assert.rejects(sessions.historyClient().request('query', { vault: 3 }), /invalid type|expected/i);
	} finally {
		sessions.dispose();
	}
}, 30_000);
