import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const require = createRequire(path.resolve('package.json'));
const { transform } = require('esbuild');
const file = 'src/platform/terminal-server/server-manager.ts';
const original = readFileSync(file, 'utf8');
const importsRemoved = original.replace(/^import[\s\S]*?;\r?\n/gm, '');
const prelude = `
const AgentDataClient=class {setWebSocket(){} destroy(){}};
const PtyClient=class {setWebSocket(){} destroy(){}};
const Notice=class {constructor(){} setMessage(){} hide(){}};
const t=(key)=>key;
const debugLog=()=>{}, debugWarn=()=>{}, errorLog=()=>{};
const buildBinaryFilename=()=> 'fixture-server';
const BinaryDownloader=class {binaryExists(){return true} needsUpdate(){return false} getDownloadConfig(){return {source:'fixture'}}};
const ServerErrorCode={CONNECTION_FAILED:'CONNECTION_FAILED',SERVER_START_FAILED:'SERVER_START_FAILED'};
const ServerManagerError=class extends Error {constructor(code,message){super(message);this.code=code}};
`;
const { code } = await transform(prelude + importsRemoved, { loader: 'ts', format: 'cjs' });
const serviceOriginal = readFileSync('src/platform/desktop/terminal/terminal-service.ts', 'utf8');
const servicePrelude = `
const NativeHistory=class {};
const AutomationHooks=class {dispose(){}};
const Notice=class {};
const t=key=>key;
const debugLog=()=>{}, debugWarn=()=>{}, errorLog=()=>{};
let nextSession=0;
const PtySession=class {
 constructor(){this.id='fixture-'+(++nextSession)}
 onNativeStatusChange(){} observeAutomation(){} destroy(){} setTitle(){}
 async handleWebSocketConnected(){} handleWebSocketDisconnected(){}
 async initializeWithServerManager(manager){await manager.ensureServer()}
};
const getSelectableShellTypes=()=>['default'];
const getCurrentPlatformCustomShellPath=()=>'';
const getCurrentPlatformShell=()=> 'default';
const setCurrentPlatformShell=()=>{};
`;
const { code: serviceCode } = await transform(servicePrelude + serviceOriginal.replace(/^import[\s\S]*?;\r?\n/gm, ''), {
	loader: 'ts',
	format: 'cjs',
});
function fixture() {
	let nextTimer = 1;
	const timers = new Map(),
		sockets = [],
		processes = [];
	class FakeWebSocket {
        send(text) { const message = JSON.parse(text); assert.equal(message.type, 'auth'); assert.equal(message.protocol, 2); this.onmessage?.({ data: JSON.stringify({ type: 'authenticated', protocol: 2 }) }); }
		static OPEN = 1;
		readyState = 0;
		constructor(url) {
			this.url = url;
			sockets.push(this);
		}
		open() {
			this.readyState = 1;
			this.onopen?.();
		}
		fail() {
			this.onerror?.({ type: 'error' });
			this.readyState = 3;
			this.onclose?.({ code: 1006, reason: 'fixture refused' });
		}
		close() {
			this.readyState = 3;
			this.onclose?.({ code: 1000, reason: 'Shutdown' });
		}
	}
	class FakeProcess extends EventEmitter {
		stdin = { end: token => { assert.match(token.trim(), /^[a-f0-9]{64}$/); } };
		stdout = new EventEmitter();
		stderr = new EventEmitter();
		killed = false;
		killCalls = [];
		kill(signal) {
			this.killed = true;
			this.killCalls.push(signal);
			if (signal === 'SIGKILL') {
				this.signalCode = signal;
				this.emit('exit', null, signal);
			}
			return true;
		}
	}
	const fs = { existsSync: () => false, promises: { stat: async () => ({ mode: 0o755 }) } };
	const spawn = () => {
		const p = new FakeProcess();
		processes.push(p);
		return p;
	};
	const ctx = {
		crypto,
		module: { exports: {} },
		process: { platform: 'linux', arch: 'x64', env: {} },
		WebSocket: FakeWebSocket,
		Buffer,
		window: {
			setTimeout: (fn, ms) => {
				const id = nextTimer++;
				timers.set(id, { fn, ms });
				return id;
			},
			clearTimeout: (id) => timers.delete(id),
			require: (name) => {
				if (name === 'fs') return fs;
				if (name === 'path') return path;
				if (name === 'child_process') return { spawn };
				throw Error('unexpected dependency ' + name);
			},
		},
	};
	vm.runInNewContext(code, ctx);
	const manager = new ctx.module.exports.ServerManager('/fixture/plugin', '0.0.3', { source: 'github-release' });
	const tick = async () => {
		for (let i = 0; i < 10; i++) await Promise.resolve();
	};
	const fire = async (ms) => {
		const entry = [...timers].find(([, t]) => t.ms === ms);
		assert.ok(entry, 'expected timer ' + ms);
		timers.delete(entry[0]);
		entry[1].fn();
		await tick();
	};
	const completeStart = async () => {
		await tick();
		processes.at(-1).stdout.emit('data', Buffer.from('{"port":12345,"pid":100,"protocol":2}'));
		await tick();
		sockets.at(-1).open();
		await tick();
	};
	const serviceContext = { module: { exports: {} } };
	vm.runInNewContext(serviceCode, serviceContext);
	const service = new serviceContext.module.exports.TerminalService(
		{
			workspace: { containerEl: { win: ctx.window } },
			vault: { adapter: { getBasePath: () => '/fixture/vault' } },
		},
		{ shellArgs: [], autoEnterVaultDirectory: false },
		manager,
	);
	return { manager, service, timers, sockets, processes, tick, fire, completeStart };
}
// An error followed by close settles startup and permits a single reconnect.
{
	const f = fixture();
	let settled = false;
	const startup = f.manager.ensureServer().then(
		() => {
			settled = true;
		},
		() => {
			settled = true;
		},
	);
	await f.tick();
	f.processes[0].stdout.emit('data', Buffer.from('{"port":12345,"pid":100,"protocol":2}'));
	await f.tick();
	f.sockets[0].fail();
	await f.tick();
	assert.equal(
		[...f.timers.values()].some((t) => t.ms === 5000),
		false,
	);
	await f.fire(1000);
	await startup;
	const retry = f.manager.ensureServer();
	await f.completeStart();
	await retry;
	assert.equal(f.manager.isConnected(), true);
	assert.equal(settled, true);
	void startup;
}
// The same manager supports reconnect after the last terminal closes and reopens.
{
	const f = fixture();
	const firstCreate = f.service.createTerminal();
	await f.completeStart();
	const first = await firstCreate;
	const stop = f.service.destroyTerminal(first.id);
	f.processes[0].emit('exit', 0, null);
	await stop;
	const reopen = f.service.createTerminal();
	await f.completeStart();
	await reopen;
	assert.equal(f.service.serverManager, f.manager);
	f.sockets.at(-1).fail();
	await f.tick();
	assert.equal(f.manager.isShuttingDown, false);
	assert.equal(
		[...f.timers.values()].some((t) => t.ms === 3000),
		true,
	);
	const reconnect = f.manager.reconnect();
	await f.tick();
	f.sockets.at(-1).open();
	await reconnect;
	assert.equal(f.manager.isConnected(), true);
}
// Shutdown cancels a queued automatic restart.
{
	const f = fixture();
	const initial = f.manager.ensureServer();
	await f.completeStart();
	await initial;
	f.processes[0].emit('exit', 1, null);
	await f.tick();
	await f.manager.shutdown();
	assert.equal(f.processes.length, 1);
	assert.equal(
		[...f.timers.values()].some((t) => t.ms === 1000),
		false,
	);
	assert.equal(f.processes.length, 1);
}
// Node's killed flag means SIGTERM was sent, not that the process exited.
{
	const f = fixture();
	const initial = f.manager.ensureServer();
	await f.completeStart();
	await initial;
	const child = f.processes[0];
	const stop = f.manager.shutdown();
	await f.tick();
	await f.fire(1000);
	await stop;
	assert.deepEqual(child.killCalls, ['SIGTERM', 'SIGKILL']);
	assert.equal(f.manager.process, null);
}
// Close-only and timeout handshakes settle all concurrent waiters and reuse one process.
for (const event of ['close', 'timeout']) {
	const f = fixture();
	const first = assert.rejects(f.manager.ensureServer());
	const second = assert.rejects(f.manager.ensureServer());
	await f.tick();
	assert.equal(f.processes.length, 1);
	f.processes[0].stdout.emit('data', Buffer.from('{"port":12345,"protocol":2}'));
	await f.tick();
	if (event === 'close') f.sockets[0].close();
	else await f.fire(5000);
	await f.tick();
	await f.fire(1000);
	await Promise.all([first, second]);
	const retry = f.manager.ensureServer();
	await f.completeStart();
	await retry;
	assert.equal(f.processes.length, 2);
	const current = f.manager.ws;
	f.sockets[0].onclose();
	assert.equal(f.manager.ws, current, 'late old close cannot detach a new socket');
}
// Shutdown during the port wait cancels startup and cannot be undone by late output.
{
	const f = fixture();
	const starting = assert.rejects(f.manager.ensureServer());
	await f.tick();
	const stopping = f.manager.shutdown();
	assert.equal(f.manager.shutdown(), stopping, 'shutdown shares one operation');
	await f.fire(1000);
	await Promise.all([starting, stopping]);
	f.processes[0].stdout.emit('data', Buffer.from('{"port":12345,"protocol":2}'));
	assert.equal(f.sockets.length, 0);
	assert.equal(f.manager.process, null);
}
// A process which never exits remains owned, and reopening retries its shutdown.
{
	const f = fixture();
	const initial = f.manager.ensureServer();
	await f.completeStart();
	await initial;
	const child = f.processes[0];
	child.kill = (signal) => {
		child.killCalls.push(signal);
		return true;
	};
	const failed = assert.rejects(f.manager.shutdown(), /did not exit/);
	await f.fire(1000);
	await f.fire(5000);
	await failed;
	assert.equal(f.manager.process, child);
	const reopen = assert.rejects(f.manager.ensureServer(), /did not exit/);
	await f.fire(1000);
	await f.fire(5000);
	await reopen;
	assert.equal(f.processes.length, 1);
	assert.equal(f.manager.process, child);
}
if (process.argv.includes('--native-signal-fixture')) {
	const f = fixture();
	const child = spawn(
		process.execPath,
		['-e', "process.on('SIGTERM',()=>{});console.log('fixture-ready');setInterval(()=>{},1000)"],
		{ env: {}, stdio: ['ignore', 'pipe', 'pipe'] },
	);
	const signals = [];
	const kill = child.kill.bind(child);
	child.kill = (signal) => {
		signals.push(signal);
		return kill(signal);
	};
	try {
		await once(child.stdout, 'data');
		f.manager.process = child;
		const stop = f.manager.shutdown();
		// Windows terminates on SIGTERM; POSIX lets this owned child resist it.
		if (process.platform !== 'win32') {
			await new Promise((r) => setTimeout(r, 50));
			await f.fire(1000);
		}
		await stop;
		let alive = false;
		try {
			process.kill(child.pid, 0);
			alive = true;
		} catch {}
		assert.equal(alive, false);
		assert.equal(child.killed, true);
		assert.deepEqual(signals, process.platform === 'win32' ? ['SIGTERM'] : ['SIGTERM', 'SIGKILL']);
		assert.ok(child.exitCode !== null || child.signalCode !== null, 'Shutdown confirms the owned process exited');
		if (process.platform !== 'win32') assert.equal(child.signalCode, 'SIGKILL');
		assert.equal(f.manager.process, null);
	} finally {
		if (child.exitCode === null && child.signalCode === null) {
			const exited = once(child, 'exit');
			child.kill('SIGKILL');
			await exited;
		}
	}
}
console.log(
	'Server lifecycle: 8 deterministic cases passed' +
		(process.argv.includes('--native-signal-fixture') ? `; native ${process.platform} process exit confirmed` : ''),
);
