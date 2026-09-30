import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { PtySession } from './pty-session';
import Headless from '@xterm/headless';
import { SerializeAddon } from '@xterm/addon-serialize';
import { TerminalPresentation } from '../../../view/terminal/runtime/terminal-presentation';
import type { ServerManager } from '../../terminal-server/server-manager';

function transport() {
	const handlers = new Map<string, (...args: any[]) => void>();
	const writes: string[] = [],
		destroyed: string[] = [],
		configurations: any[] = [], resizes: [number, number][] = [];
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
		resize: (_id: string, cols: number, rows: number) => resizes.push([cols, rows]),
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
		resizes,
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
		await settled();
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
		await settled();
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

test('a renderer attaching during a partially parsed chunk does not replay its prefix twice', async () => {
	const io = transport(), session = new PtySession();
	const browser = new Headless.Terminal({ cols: 80, rows: 24, allowProposedApi: true });
	const serialized = new SerializeAddon();
	browser.loadAddon(serialized);
	try {
		await session.initializeWithServerManager(io.manager);
		let attached = false;
		(session as any).emulator.parser.registerCsiHandler({ final: 'z' }, () => {
			attached = true;
			session.onOutput((text) => browser.write(text));
			return true;
		});
		io.output('prefix\x1b[zsuffix');
		await settled();
		await settled();
		assert.equal(attached, true);
		assert.equal(serialized.serialize(), 'prefixsuffix');
	} finally {
		browser.dispose();
		session.destroy();
	}
});

test('hidden prompt and failed-command positions follow headless parsing and survive replay', async () => {
	const io = transport(), session = new PtySession({ scrollback: 2000 });
	try {
		await session.initializeWithServerManager(io.manager);
		const shell = (type: string, exitCode: number | null = null) => io.handlers.get('shell')!({ type, exitCode, source: 'osc133' });
		io.output('first prompt'); shell('prompt_start');
		io.output('\r\ncommand output'); shell('command_start'); shell('command_end', 7);
		io.output('\r\nsecond prompt'); shell('prompt_start');
		await settled();
		assert.deepEqual(session.getNavigationMarkers(), { prompts: [0, 2], commands: [{ line: 1, exitCode: 7 }] });
		let screen = '';
		const off = session.onOutput((text) => { screen = text; });
		await settled();
		assert.match(screen, /second prompt/);
		assert.deepEqual(session.getNavigationMarkers().prompts, [0, 2]);
		off();
		io.output('\r\n' + 'line\r\n'.repeat(2100));
		await settled();
		assert.deepEqual(session.getNavigationMarkers(), { prompts: [], commands: [] });
	} finally { session.destroy(); }
});

test('command history and prompt/command markers are bounded to the latest 1000', async () => {
	const io = transport(), session = new PtySession({ scrollback: 2000 });
	try {
		await session.initializeWithServerManager(io.manager);
		for (let i = 0; i < 1100; i++) {
			io.handlers.get('shell')!({ type: 'prompt_start', source: 'osc133', exitCode: null });
			io.handlers.get('shell')!({ type: 'command_start', source: 'osc133', exitCode: null });
			io.handlers.get('shell')!({ type: 'command_end', source: 'osc133', exitCode: i });
		}
		await new Promise<void>((resolve) => (session as any).emulator.write('', resolve));
		const history = session.getCommandHistory(), navigation = session.getNavigationMarkers();
		assert.equal(history.length, 1000);
		assert.equal(history[0]!.exitCode, 100);
		assert.equal(history.at(-1)!.exitCode, 1099);
		assert.equal(navigation.prompts.length, 1000);
		assert.equal(navigation.commands.length, 1000);
		assert.equal(navigation.commands[0]!.exitCode, 100);
	} finally { session.destroy(); }
});

test('unchanged grids do not send a native resize and an unsubscribed pending snapshot never fires', async () => {
	const io = transport(), session = new PtySession();
	try {
		await session.initializeWithServerManager(io.manager);
		session.resize(80, 24); session.resize(90, 25); session.resize(90, 25);
		assert.deepEqual(io.resizes, [[90, 25]]);
		let callbacks = 0;
		const off = session.onOutput(() => callbacks++);
		off();
		await settled();
		assert.equal(callbacks, 0);
	} finally { session.destroy(); }
});

test('a grid change between queued browser writes restores the reflowed headless screen', async () => {
	const io = transport(), session = new PtySession();
	const browser = new Headless.Terminal({ cols: 80, rows: 24, allowProposedApi: true });
	const serialized = new SerializeAddon();
	browser.loadAddon(serialized);
	let held: (() => void) | undefined, resizeQueued = false;
	const presentation = new TerminalPresentation({
		subscribe: (output) => session.onOutput((text) => {
			output(text);
			if (text === 'A\r\n' && !resizeQueued) {
				resizeQueued = true;
				presentation.afterParsed(() => { browser.resize(40, 24); session.resize(40, 24); presentation.refresh(); });
			}
		}),
		reset: () => browser.reset(), beforeReplay: () => {}, afterReplay: () => {},
		write: (text, done) => browser.write(text, () => { if (text === 'A\r\n') held = done; else done(); }),
		error: (error) => { throw error; },
	});
	try {
		await session.initializeWithServerManager(io.manager);
		presentation.setVisible(true);
		await settled();
		io.output('A\r\n');
		io.output('\x1b[2;70HZ');
		await settled(); await settled();
		assert.ok(held);
		held();
		await settled(); await settled();
		assert.deepEqual(io.resizes, [[40, 24]]);
		assert.equal(serialized.serialize(), (session as any).serializer.serialize());
	} finally { presentation.dispose(); browser.dispose(); session.destroy(); }
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
