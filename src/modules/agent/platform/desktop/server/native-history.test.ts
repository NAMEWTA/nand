import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createRequire } from 'node:module';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { App } from 'obsidian';
import { initializeTestDevice } from '../../../../../../test/fixtures/vault-storage';
import { NativeHistory } from '../../history/service';
import type { HistoryClientSource } from './agent-data-client.ts';
import { normalizeAgentSettings } from '../../../core/launch/defaults.ts';
import type { HistoryPage } from './agent-data-client.ts';
import { nativeVaultStorage } from '../../../../../host/desktop/vault-storage';
import { deviceId } from '../../../../../host/obsidian/storage/device-id';
import { prepareLegacyAccounts } from '../agents/legacy-accounts';
import { accountEnv } from '../agents/accounts';
import { getAgent } from '../../../core/launch/catalog';

globalThis.window = { require: createRequire(import.meta.url) } as unknown as Window & typeof globalThis;
const page: HistoryPage = { rows: [], total: 0, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: null, known: false }, revision: 1 };
test('an unbound legacy account produces a warning while other account history is scanned', async () => {
	const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'nand-history-unbound-'));
	const plugin = path.join(vault, '.obsidian/plugins/nand');
	await fs.mkdir(path.join(plugin, 'accounts/claude/old/home'), { recursive: true });
	await fs.writeFile(path.join(plugin, 'accounts/claude/old/home/auth.json'), '{}');
	try {
		const app = { vault: { adapter: { ...nativeVaultStorage(vault), getBasePath: () => vault } } } as unknown as App;
		await initializeTestDevice(app);
		await assert.rejects(prepareLegacyAccounts({ vault, device: deviceId(app), plugin, boot: 'one' }));
		const release = await prepareLegacyAccounts({ vault, device: deviceId(app), plugin, boot: 'two' });
		const settings = normalizeAgentSettings({}); settings.agents['claude-code'].enabled = false;
		let roots: Array<{ agentId: string; accountKey: string }> = [];
		const client = { isConnected: () => true, connectionRevision: 1, subscribeConnection: () => () => {}, request: async (_op: string, payload: { roots: typeof roots }) => { roots = payload.roots; return { warnings: [], revision: 1 }; } };
		const history = new NativeHistory(app, { historyClient: async () => client } as unknown as HistoryClientSource, () => settings);
		try {
			const warnings = await history.scan();
			assert.ok(roots.some(row => row.agentId === 'codex'));
			assert.ok(!roots.some(row => row.agentId === 'claude-code'));
			assert.equal(warnings.length, 1);
			const oldKey = JSON.stringify(['claude-code', JSON.stringify({ CLAUDE_CONFIG_DIR: path.join(plugin, 'accounts/claude/old/home') }), 'session']);
			await history.update(oldKey, { title: '保留标题', favorite: true, tags: ['重要'] });
			const unbind = await prepareLegacyAccounts({ vault, device: deviceId(app), plugin, boot: 'two', choose: async () => 'old' });
			settings.agents['claude-code'].accountId = 'a.b';
			await accountEnv(getAgent('claude-code'), 'a.b', vault, deviceId(app), true);
			await history.scan();
			const current = roots.find(row => row.agentId === 'claude-code')!;
			const key = JSON.stringify(['claude-code', current.accountKey, 'session']);
			assert.deepEqual(history.meta(key), { title: '保留标题', favorite: true, tags: ['重要'] });
			await history.update(key, { title: '新标题' });
			assert.equal(history.meta(key).title, '新标题');
			assert.equal(history.meta(oldKey).title, '保留标题');
			unbind();
		} finally { await history.dispose(); release(); }
	} finally { await fs.rm(vault, { recursive: true, force: true }); }
}, 30000);
test('history scan sends only vault account sources and the same resumable account environment', async () => {
	const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'nand-history-owned-'));
	try {
		const app = { vault: { adapter: { ...nativeVaultStorage(vault), getBasePath: () => vault } } } as unknown as App;
		await initializeTestDevice(app);
		const requests: Array<{ roots: Array<{ agentId: string; path: string; accountKey: string }> }> = [];
		const client = { isConnected: () => true, connectionRevision: 1, subscribeConnection: () => () => {}, request: async (_operation: string, payload: unknown) => { requests.push(payload as typeof requests[number]); return { warnings: [], revision: 1 }; } };
		const history = new NativeHistory(app, { historyClient: async () => client } as unknown as HistoryClientSource, () => normalizeAgentSettings({}));
		await history.scan();
		assert.equal(requests[0]?.roots.length, 6);
		for (const source of requests[0]!.roots) {
			assert.ok(source.path.startsWith(path.join(vault, '.nand', 'agents') + path.sep), source.path);
			const env = JSON.parse(source.accountKey) as Record<string, string>;
			assert.ok(env.NAND_ACCOUNT_ID?.startsWith(source.agentId + '/'));
			assert.ok(source.path.startsWith(env.NAND_ACCOUNT_ROOT! + path.sep));
		}
		await history.dispose();
	} finally { await fs.rm(vault, { recursive: true, force: true }); }
}, 30000);
test('native history shares scan/query/usage, revisions invalidate leaves, and aborts are consumer scoped', async () => {
	const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'nand-history-model-'));
	try {
		const files = new Map<string, string>(), requests: Array<{ operation: string; signal: AbortSignal | undefined }> = [];
		let release!: () => void;
		const wait = new Promise<void>(resolve => { release = resolve; });
		let scanStarted!: () => void;
		const atScan = new Promise<void>(resolve => { scanStarted = resolve; });
		const settings = normalizeAgentSettings({});
		const app = { loadLocalStorage: () => '11111111-1111-4111-8111-111111111111', vault: { adapter: { getBasePath: () => fixture, exists: async (name: string) => files.has(name), read: async (name: string) => files.get(name), write: async (name: string, body: string) => { files.set(name, body); }, mkdir: async (name: string) => { files.set(name, 'directory'); } } } } as unknown as App;
		await initializeTestDevice(app);
		let connectionChanged!: () => void;
		const client = { connected: true, isConnected: () => client.connected, connectionRevision: 1, subscribeConnection: (listener: () => void) => { connectionChanged = listener; return () => {}; }, request: async (operation: string, _payload: unknown, signal: AbortSignal | undefined) => {
			requests.push({ operation, signal });
			if (operation === 'scan') { scanStarted(); await wait; return { warnings: [], revision: 0 }; }
			return page;
		} };
		const service = { historyClient: async () => client } as unknown as HistoryClientSource;
		const history = new NativeHistory(app, service, () => settings);
		let changes = 0; const dispose = history.subscribe(() => { changes++; });
		const abort = new AbortController();
		const first = history.scan(abort.signal), second = history.refresh();
		await atScan;
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
}, 30000);

test('history requests cancelled while awaiting a client never execute the native operation', async () => {
	const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'nand-history-cancel-'));
	try {
		const files = new Map<string, string>();
		const app = { loadLocalStorage: () => '11111111-1111-4111-8111-111111111111', vault: { adapter: { getBasePath: () => fixture, exists: async (name: string) => files.has(name), read: async (name: string) => files.get(name), write: async (name: string, body: string) => { files.set(name, body); }, mkdir: async () => {} } } } as unknown as App;
		await initializeTestDevice(app);
		for (const operation of ['query', 'scan', 'read'] as const) {
			let entered!: () => void, release!: () => void;
			const atClient = new Promise<void>(resolve => { entered = resolve; });
			const gate = new Promise<void>(resolve => { release = resolve; });
			let requests = 0;
			const client = { connectionRevision: 1, subscribeConnection: () => () => {}, request: async () => { requests++; return operation === 'scan' ? { warnings: [], revision: 0 } : page; } };
			const service = { historyClient: async () => { entered(); await gate; return client; } } as unknown as HistoryClientSource;
			const history = new NativeHistory(app, service, () => normalizeAgentSettings({}));
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
}, 30000);
