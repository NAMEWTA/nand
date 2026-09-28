import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { PtySession } from './pty-session';
import type { ServerManager } from '../../terminal-server/server-manager';

function transport() {
	const handlers = new Map<string, (...args: any[]) => void>();
	const writes: string[] = [],
		destroyed: string[] = [],
		configurations: any[] = [];
	let nextId = 0;
	const subscribe = (name: string, cb: (...args: any[]) => void) => {
		handlers.set(name, cb);
		return () => handlers.delete(name);
	};
	const client = {
		isConnected: () => true,
		init: async (options: any, ready: (id: string) => void) => {
			configurations.push(options);
			ready(String(++nextId));
		},
		write: (_id: string, text: string) => writes.push(text),
		writeBinary: () => {},
		resize: () => {},
		destroySession: (id: string) => destroyed.push(id),
		onSessionOutput: (_id: string, cb: (...args: any[]) => void) => subscribe('output', cb),
		onSessionExit: (_id: string, cb: (...args: any[]) => void) => subscribe('exit', cb),
		onSessionError: (_id: string, cb: (...args: any[]) => void) => subscribe('error', cb),
		onSessionShellEvent: (_id: string, cb: (...args: any[]) => void) => subscribe('shell', cb),
	};
	return {
		handlers,
		writes,
		destroyed,
		configurations,
		client,
		manager: { ensureServer: async () => {}, pty: () => client } as unknown as ServerManager,
		output: (text: string | Uint8Array) =>
			handlers.get('output')?.(typeof text === 'string' ? new TextEncoder().encode(text) : text),
	};
}
async function settled() {
	await delay(25);
}

test('headless process consumes split UTF-8 and VT queries without a DOM or renderer', async () => {
	const io = transport(),
		session = new PtySession({ cwd: '/tmp' });
	try {
		const events: any[] = [];
		session.observeAutomation((e) => events.push(e));
		await session.initializeWithServerManager(io.manager);
		const bytes = new TextEncoder().encode('你好');
		io.output(bytes.slice(0, 2));
		io.output(bytes.slice(2));
		io.output('\x1b[6n');
		await settled();
		assert.equal(
			events
				.filter((e) => e.kind === 'data')
				.map((e) => e.text)
				.join(''),
			'你好\x1b[6n',
		);
		assert.deepEqual(io.writes, ['\x1b[1;5R']);
		const received: string[] = [];
		const detach = session.onOutput((text) => received.push(text));
		assert.match(received[0]!, /你好/);
		assert.ok(!received[0]!.includes('\x1b[6n'), 'replay must not repeat device queries');
		detach();
		io.output(' still running');
		await settled();
		assert.equal(session.isAlive(), true);
		let replay = '';
		session.onOutput((text) => {
			replay += text;
		});
		assert.match(replay, /still running/);
	} finally {
		session.destroy();
	}
	assert.equal(io.handlers.size, 0);
	assert.equal(io.destroyed.length, 1);
});

test('queued output is delivered exactly once when a renderer attaches before parsing completes', async () => {
	const io = transport(),
		session = new PtySession();
	try {
		await session.initializeWithServerManager(io.manager);
		io.output('before');
		const received: string[] = [];
		const off = session.onOutput((s) => received.push(s));
		io.output('after');
		await settled();
		assert.equal(received.join(''), 'beforeafter');
		off();
		session.destroy();
		session.destroy();
		let disposed = 0;
		session.onDispose(() => disposed++);
		assert.equal(disposed, 1);
		assert.equal(io.destroyed.length, 1);
	} finally {
		session.destroy();
	}
});

test('scheduled automation interrupts instead of silently restarting after a disconnect', async () => {
	const io = transport(),
		session = new PtySession();
	const events: any[] = [];
	session.automationManaged = true;
	session.observeAutomation((e) => events.push(e));
	await session.initializeWithServerManager(io.manager);
	session.handleWebSocketDisconnected();
	await session.handleWebSocketConnected(io.manager);
	assert.equal(session.isDisposed, true);
	assert.equal(events.filter((e) => e.kind === 'interrupted').length, 1);
	assert.equal(io.configurations.length, 1);
	assert.equal(io.handlers.size, 0);
});

test('interactive recovery falls back if the current directory was deleted', async () => {
	const io = transport(),
		session = new PtySession({ cwd: '/initial' });
	try {
		await session.initializeWithServerManager(io.manager);
		io.output('\x1b]7;file://localhost/deleted\x07');
		await settled();
		session.handleWebSocketDisconnected();
		assert.equal(session.isAlive(), false);
		const original = io.client.init;
		io.client.init = async (options, ready) => {
			if (options.cwd === '/deleted') throw new Error('ENOENT');
			await original(options, ready);
		};
		await session.handleWebSocketConnected(io.manager);
		assert.equal(session.isAlive(), true);
		assert.equal(io.configurations.at(-1).cwd, '/initial');
	} finally {
		session.destroy();
	}
});

test('disposal during native startup destroys the late process without subscriptions', async () => {
	const io = transport(),
		session = new PtySession();
	let ready: (id: string) => void = () => {};
	io.client.init = async (_config, callback) => {
		ready = callback;
		await delay(10);
	};
	const startup = session.initializeWithServerManager(io.manager);
	await delay(1);
	session.destroy();
	ready('late');
	await startup;
	assert.deepEqual(io.destroyed, ['late']);
	assert.equal(io.handlers.size, 0);
});
