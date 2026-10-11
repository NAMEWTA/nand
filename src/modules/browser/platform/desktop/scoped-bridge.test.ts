import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { createConnection } from 'node:net';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ScopedBrowserGrant } from '../../core/scoped-grant';
import { BrowserBridge } from './bridge';
import type { ElectronBrowserApi } from './electron-api';
import type { BrowserAutomationPort } from '../../core/model';

function rpc(bridge: BrowserBridge, token: string, method: string, params: Record<string, unknown> = {}): Promise<{ ok: boolean; result?: unknown; error?: { code: string } }> {
	return new Promise((resolve, reject) => {
		const socket = createConnection(bridge.endpoint); let data = '';
		socket.setTimeout(3000, () => { socket.destroy(); reject(Error('Fixture RPC timed out')); });
		socket.on('error', reject); socket.on('data', chunk => { data += chunk.toString(); });
		socket.on('end', () => { socket.destroy(); resolve(JSON.parse(data)); });
		socket.on('connect', () => socket.write(JSON.stringify({ id: 'test', token, method, params }) + '\n'));
	});
}
async function fixture(enabled = true, execute?: BrowserAutomationPort['execute']) {
	const root = mkdtempSync(join(tmpdir(), 'nand-scoped-bridge-')), calls: string[] = [];
	const win = { require: createRequire(join(process.cwd(), 'package.json')) } as unknown as Window;
	const api = { app: { getPath: () => root } } as unknown as ElectronBrowserApi;
	const bridge = new BrowserBridge(win, api, 'fixture-vault', { execute: execute ?? (async method => { calls.push(method); return 'ordinary'; }) }, enabled);
	await bridge.start(); return { bridge, calls };
}

test('scoped tokens reach only their delegated page/action authority and never the broad bridge fallback', async () => {
	const { bridge, calls } = await fixture(), abort = new AbortController(), target = { pageId: 'page', profileId: 'account', generation: 'generation' };
	const expiresAt = Date.now() + 10_000, grant = new ScopedBrowserGrant({ id: 'grant', taskId: 'task', targets: [target], operations: ['snapshot'], expiresAt, maxOperations: 5 }, Date.now);
	try {
		const scoped = bridge.createScoped({ execute: async (method, params) => {
			grant.reserve(method, { ...target, pageId: String(params.page) }).admit(); return 'selected page only';
		} }, abort.signal, expiresAt), token = scoped.environment.NAND_BROWSER_TOKEN!;
		assert.notEqual(token, bridge.environment.NAND_BROWSER_TOKEN);
		assert.deepEqual(await rpc(bridge, token, 'snapshot', { page: 'page' }), { id: 'test', ok: true, result: 'selected page only' });
		assert.equal((await rpc(bridge, token, 'snapshot', { page: 'other' })).error?.code, 'browser_scoped_grant_scope');
		assert.equal((await rpc(bridge, token, 'fill', { page: 'page' })).error?.code, 'browser_scoped_grant_scope');
		assert.equal((await rpc(bridge, token, 'tab.create')).error?.code, 'browser_scoped_grant_scope');
		assert.equal(calls.length, 0);
		for (const file of readdirSync(bridge.directory)) assert.equal(readFileSync(join(bridge.directory, file), 'utf8').includes(token), false, 'Scoped credential must never be written to runtime files');
		scoped.dispose(); assert.equal((await rpc(bridge, token, 'snapshot', { page: 'page' })).error?.code, 'browser_unauthorized');
		assert.equal((await rpc(bridge, bridge.environment.NAND_BROWSER_TOKEN!, 'tab.list')).result, 'ordinary'); assert.deepEqual(calls, ['tab.list']);
	} finally { abort.abort(); bridge.dispose(); }
});

test('revoking a scoped connection and closing a caller transport abort in-flight delegated work', async () => {
	const { bridge } = await fixture(), owner = new AbortController();
	try {
		for (const disconnect of [false, true]) {
			let entered!: () => void, stopped!: () => void;
			const start = new Promise<void>(resolve => { entered = resolve; }), end = new Promise<void>(resolve => { stopped = resolve; });
			const scoped = bridge.createScoped({ execute: async (_method, _params, signal) => {
				entered(); await new Promise<void>(resolve => { if (signal.aborted) resolve(); else signal.addEventListener('abort', () => resolve(), { once: true }); });
				stopped(); return { cancelled: true };
			} }, owner.signal, Date.now() + 10_000);
			const socket = createConnection(bridge.endpoint); socket.on('error', () => {}); socket.on('data', () => {});
			socket.on('connect', () => socket.write(JSON.stringify({ id: 'pending', token: scoped.environment.NAND_BROWSER_TOKEN, method: 'snapshot', params: {} }) + '\n'));
			await start; if (disconnect) socket.destroy(); else scoped.dispose(); await end;
			socket.destroy(); scoped.dispose();
		}
		const scoped = bridge.createScoped({ execute: async () => 'unused' }, owner.signal, Date.now() + 10_000); owner.abort();
		assert.equal((await rpc(bridge, scoped.environment.NAND_BROWSER_TOKEN!, 'snapshot')).error?.code, 'browser_unauthorized');
	} finally { bridge.dispose(); }
});

test('scoped transport stores only token hashes and expiry aborts work already waiting', async () => {
	const { bridge } = await fixture(false), owner = new AbortController(); let started = false, stopped = false;
	try {
		assert.deepEqual(bridge.environment, {});
		const connection = bridge.createScoped({ execute: async (_method, _params, signal) => {
			started = true; await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true })); stopped = true; return 'aborted';
		} }, owner.signal, Date.now() + 300), token = connection.environment.NAND_BROWSER_TOKEN!;
		const registry = (bridge as unknown as { scoped: Map<string, unknown> }).scoped;
		assert.deepEqual([...registry.keys()], [createHash('sha256').update(token).digest('hex')]);
		const pending = rpc(bridge, token, 'snapshot'); await vi.waitFor(() => assert.equal(started, true));
		await pending; assert.equal(stopped, true); assert.equal(registry.size, 0);
		assert.equal((await rpc(bridge, token, 'snapshot')).error?.code, 'browser_unauthorized');
	} finally { owner.abort(); bridge.dispose(); }
});

test('disabling broad access invalidates its token without revoking explicit scoped connections', async () => {
	const { bridge, calls } = await fixture(false), owner = new AbortController();
	try {
		assert.deepEqual(bridge.environment, {}); bridge.setBroadEnabled(true); const old = bridge.environment.NAND_BROWSER_TOKEN!;
		const scoped = bridge.createScoped({ execute: async () => 'scoped' }, owner.signal, Date.now() + 10000);
		bridge.setBroadEnabled(false); assert.deepEqual(bridge.environment, {});
		assert.equal((await rpc(bridge, old, 'tab.list')).error?.code, 'browser_unauthorized');
		assert.equal((await rpc(bridge, scoped.environment.NAND_BROWSER_TOKEN!, 'snapshot')).result, 'scoped');
		bridge.setBroadEnabled(true); assert.notEqual(bridge.environment.NAND_BROWSER_TOKEN, old);
		assert.equal((await rpc(bridge, old, 'tab.list')).error?.code, 'browser_unauthorized'); assert.equal(calls.length, 0);
	} finally { owner.abort(); bridge.dispose(); }
});

test('public bridge failures retain symbolic guidance but never echo exception secrets', async () => {
	const { bridge } = await fixture(false), owner = new AbortController();
	try {
		const scoped = bridge.createScoped({ execute: async () => { throw Error('private exception value'); } }, owner.signal, Date.now() + 10000);
		const result = await rpc(bridge, scoped.environment.NAND_BROWSER_TOKEN!, 'snapshot');
		assert.equal(result.error?.code, 'browser_failed'); assert.equal(JSON.stringify(result).includes('private exception value'), false);
		assert.equal((result.error as { retryAction?: string }).retryAction, 'check-page');
	} finally { owner.abort(); bridge.dispose(); }
});

test('generated CLI forwards task identity and an empty expected draft without logging its credential', async () => {
	const { bridge } = await fixture(false), owner = new AbortController();
	try {
		const scoped = bridge.createScoped({ execute: async (method, params) => ({ method, params }) }, owner.signal, Date.now() + 10000);
		const result = await promisify(execFile)(process.execPath, [bridge.cliPath, 'fill', '--page', 'selected', '--value', 'new text', '--expectedValue', ''],
			{ env: { ...process.env, ...scoped.environment, NAND_BROWSER_TASK: 'selected-task' } });
		assert.deepEqual(JSON.parse(result.stdout).result, { method: 'fill', params: { page: 'selected', value: 'new text', expectedValue: '', taskId: 'selected-task' } });
		assert.equal(result.stdout.includes(scoped.environment.NAND_BROWSER_TOKEN!), false); assert.equal(result.stderr, '');
	} finally { owner.abort(); bridge.dispose(); }
});

test('turning broad access off invalidates a request waiting for native admission even after re-enable', async () => {
	let entered!: () => void, release!: () => void, mutations = 0;
	const starting = new Promise<void>(resolve => { entered = resolve; }), waiting = new Promise<void>(resolve => { release = resolve; });
	const { bridge } = await fixture(true, async (_method, _params, admit) => { entered(); await waiting; admit?.(); mutations++; return 'changed'; });
	try {
		const pending = rpc(bridge, bridge.environment.NAND_BROWSER_TOKEN!, 'fill', { page: 'selected' }); await starting;
		bridge.setBroadEnabled(false); bridge.setBroadEnabled(true); release();
		assert.equal((await pending).error?.code, 'browser_unauthorized'); assert.equal(mutations, 0);
	} finally { release(); bridge.dispose(); }
});

test('generated CLI rejects malformed connection metadata with symbolic JSON and no raw exception', async () => {
	const { bridge } = await fixture(false);
	try {
		for (const metadata of [null, {}, { endpoint: {} }, { endpoint: '' }]) {
			writeFileSync(bridge.contextPath, JSON.stringify(metadata));
			const result = await promisify(execFile)(process.execPath, [bridge.cliPath, 'tab', 'list'], { env: { ...process.env, NAND_BROWSER_CONTEXT: bridge.contextPath } })
				.then(value => ({ ...value, code: 0 }), (error: { code: number; stdout: string; stderr: string }) => error);
			assert.equal(result.code, 1); assert.equal(result.stderr, '');
			assert.equal(JSON.parse(result.stdout).error.code, 'browser_connection_invalid');
		}
	} finally { bridge.dispose(); }
});
