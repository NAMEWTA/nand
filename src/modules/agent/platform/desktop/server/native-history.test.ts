import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createRequire } from 'node:module';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { App } from 'obsidian';
import { buildSync } from 'esbuild';
import type { HistoryClientSource } from './agent-data-client.ts';
import { normalizeAgentSettings } from '../../../core/launch/defaults.ts';
import type { HistoryPage } from './agent-data-client.ts';

globalThis.window = { require: createRequire(import.meta.url) } as unknown as Window & typeof globalThis;
// The production adapter also imports JsonStore, whose parameter properties
// require transformation. Keep the repository's strip-only test runner intact.
const bundled = buildSync({ entryPoints: ['src/modules/agent/platform/history/service.ts'], bundle: true, platform: 'node', format: 'esm', write: false, alias: { obsidian: './scripts/obsidian-stub.ts' } }).outputFiles[0]!.text;
const { NativeHistory } = await import(`data:text/javascript;base64,${Buffer.from(bundled).toString('base64')}`) as { NativeHistory: typeof import('../../history/service.ts').NativeHistory };
const page: HistoryPage = { rows: [], total: 0, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: null, known: false }, revision: 1 };
test('native history shares scan/query/usage, revisions invalidate leaves, and aborts are consumer scoped', async () => {
	const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'nand-history-model-'));
	try {
		const files = new Map<string, string>(), requests: Array<{ operation: string; signal: AbortSignal | undefined }> = [];
		let release!: () => void;
		const wait = new Promise<void>(resolve => { release = resolve; });
		const settings = normalizeAgentSettings({});
		const app = { loadLocalStorage: () => '11111111-1111-4111-8111-111111111111', vault: { adapter: { getBasePath: () => fixture, exists: async (name: string) => files.has(name), read: async (name: string) => files.get(name), write: async (name: string, body: string) => { files.set(name, body); }, mkdir: async (name: string) => { files.set(name, 'directory'); } } } } as unknown as App;
		let connectionChanged!: () => void;
		const client = { connected: true, isConnected: () => client.connected, connectionRevision: 1, subscribeConnection: (listener: () => void) => { connectionChanged = listener; return () => {}; }, request: async (operation: string, _payload: unknown, signal: AbortSignal | undefined) => {
			requests.push({ operation, signal });
			if (operation === 'scan') { await wait; return { warnings: [], revision: 0 }; }
			return page;
		} };
		const service = { historyClient: async () => client } as unknown as HistoryClientSource;
		const history = new NativeHistory(app, service, () => settings, '.obsidian/plugins/nand');
		let changes = 0; const dispose = history.subscribe(() => { changes++; });
		const abort = new AbortController();
		const first = history.scan(abort.signal), second = history.refresh();
		await new Promise(resolve => setTimeout(resolve, 30));
		assert.equal(requests.filter(r => r.operation === 'scan').length, 1);
		abort.abort(); await assert.rejects(first, /cancelled/);
		assert.equal(requests[0]?.signal?.aborted, false, 'another subscriber still owns the scan');
		release(); await second;
		assert.equal(history.indexRevision, 0);
		assert.equal(history.hasScanned, true, 'an empty successful index is initialized even at revision zero');
		const beforeQuery = changes;
		await Promise.all([history.query(), history.query(), history.usage()]);
		assert.equal(requests.filter(r => r.operation === 'query').length, 1);
		assert.equal(changes, beforeQuery, 'queries must not feed a subscription loop');
		await history.update('session', { favorite: true });
		assert.ok(changes > beforeQuery); assert.equal(history.meta('session').favorite, true);
		await history.query(); assert.equal(requests.filter(r => r.operation === 'query').length, 2);
		settings.agents.codex.accountId = 'other-account';
		await history.query(); assert.equal(requests.filter(r => r.operation === 'query').length, 3);
		const beforeDisconnect = changes;
		client.connected = false; client.connectionRevision++; connectionChanged();
		assert.equal(changes, beforeDisconnect, 'intentional server shutdown must not trigger subscriber queries that restart it');
		client.connected = true; client.connectionRevision++; connectionChanged();
		assert.ok(changes > beforeDisconnect);
		await history.query(); assert.equal(requests.filter(r => r.operation === 'query').length, 4, 'server reconnection invalidates cached pages');
		await history.refresh(); assert.equal(requests.filter(r => r.operation === 'scan').length, 2, 'explicit refresh always scans');
		const atDispose = changes; dispose(); await history.update('session', { favorite: false }); assert.equal(changes, atDispose);
		await history.dispose(); await assert.rejects(history.query(), /disposed/);
	} finally { await fs.rm(fixture, { recursive: true }); }
});

test('history requests cancelled while awaiting a client never execute the native operation', async () => {
	const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'nand-history-cancel-'));
	try {
		const app = { loadLocalStorage: () => '11111111-1111-4111-8111-111111111111', vault: { adapter: { getBasePath: () => fixture, exists: async () => false } } } as unknown as App;
		for (const operation of ['query', 'scan', 'read'] as const) {
			let entered!: () => void, release!: () => void;
			const atClient = new Promise<void>(resolve => { entered = resolve; });
			const gate = new Promise<void>(resolve => { release = resolve; });
			let requests = 0;
			const client = { connectionRevision: 1, subscribeConnection: () => () => {}, request: async () => { requests++; return operation === 'scan' ? { warnings: [], revision: 0 } : page; } };
			const service = { historyClient: async () => { entered(); await gate; return client; } } as unknown as HistoryClientSource;
			const history = new NativeHistory(app, service, () => normalizeAgentSettings({}), '.obsidian/plugins/nand');
			const abort = new AbortController();
			const pending = operation === 'query' ? history.query('', 0, abort.signal) : operation === 'scan' ? history.scan(abort.signal) : history.read({ key: 'fixture' } as import('./agent-data-client.ts').NativeSessionSummary, abort.signal);
			const rejected = assert.rejects(pending, /cancelled/);
			await atClient;
			abort.abort(); release(); await rejected;
			await new Promise(resolve => setTimeout(resolve, 0));
			assert.equal(requests, 0, operation);
			await history.dispose();
		}
	} finally { await fs.rm(fixture, { recursive: true }); }
});
