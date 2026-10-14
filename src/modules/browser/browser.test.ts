import assert from 'node:assert/strict';
import { test } from 'vitest';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { normalizeBrowserUrl, recordHistory, historySuggestions } from '../../modules/browser/core/url';
import { newPageState } from '../../modules/browser/core/model';
import { BrowserOperationQueue } from '../../modules/browser/core/operation-queue';
import { browserAgentMaterial } from '../../modules/browser/core/agent-material';
import { SessionMaterialService } from '../../modules/agent/services/session-material';
import type { AgentController } from '../../modules/agent/services/controller';
import {
	arrowHeadGeometry,
	commitShape,
	createMarkupDocument,
	normalizeRect,
	redoShape,
	scaleShape,
	undoShape,
	type MarkupShape,
} from '../../modules/browser/core/markup-model';
import { parse as parseDashboard, serialize as serializeDashboard } from '../../modules/home/core/board/parser/parse';
import { buildSnapshot } from '../../modules/browser/platform/desktop/snapshot-engine';
import { acquireDebugger } from '../../modules/browser/platform/desktop/debugger-lease';
import { GUEST_POLICY_SOURCE } from '../../modules/browser/platform/desktop/guest-policy';
import type { ElectronBrowserApi, GuestContents } from '../../modules/browser/platform/desktop/electron-api';

test('URL normalization preserves parameters and distinguishes local services, domains and searches', () => {
	for (const [input, expected] of [
		['localhost:3000/a?q=中文#x', 'http://localhost:3000/a?q=%E4%B8%AD%E6%96%87#x'],
		['127.0.0.1:8080', 'http://127.0.0.1:8080/'],
		['[::1]:3000', 'http://[::1]:3000/'],
		['example.com/a?x=1&y=2', 'https://example.com/a?x=1&y=2'],
		['http://localhost:3000', 'http://localhost:3000/'],
		['something to find', 'https://www.google.com/search?q=something%20to%20find'],
		['example.com:8443', 'https://example.com:8443/'],
	] as const)
		assert.equal(normalizeBrowserUrl(input, 'google'), expected);
	for (const input of [
		'javascript:alert(1)',
		'file:///C:/private',
		'data:text/html,x',
		'obsidian://open',
		'https://user:secret@example.com',
		'C:\\file.txt',
		'https://',
		'http://localhost:65536',
	])
		assert.throws(() => normalizeBrowserUrl(input, 'google'));
	assert.equal(normalizeBrowserUrl(''), 'about:blank');
	assert.match(normalizeBrowserUrl('你好', 'bing'), /^https:\/\/www.bing.com\/search/);
});

test('agent attachment strips escape/control sequences, bounds page text and never appends Enter', () => {
	const value = browserAgentMaterial('text\x1b[201~\x00\r\n中文', ['C:/test.png']);
	assert.equal(value.includes('\x1b'), false);
	assert.equal(value.includes('\x00'), false);
	assert.equal(value.endsWith('\n'), false);
	assert.match(value, /中文/);
	assert.ok(browserAgentMaterial('x'.repeat(30000), []).length <= 20002);
});

test('Agent delivery refuses shell/unready sessions and only pastes into the selected input', async () => {
	let ready = false;
	const pasted: string[] = [];
	const selected: string[] = [];
	const sessions = [
		{ id: 'agent', agentId: 'codex', title: 'Agent', running: true, automated: false, inputReady: () => ready, paste: (text: string) => pasted.push(text) },
		{ id: 'shell', title: 'Shell', running: true, automated: false, inputReady: () => true, paste: () => {} },
	];
	const host = {
		app: { workspace: { containerEl: { win: { setInterval, clearInterval } } } },
		sessions: { list: () => sessions, get: (id: string) => sessions.find((s) => s.id === id) },
		show: (id: string) => { selected.push(id); },
		open: async () => {},
	} as unknown as AgentController;
	const delivery = new SessionMaterialService(host);
	const attach = (id: string, text: string, files: string[]) => delivery.attachMaterial(id, { title: 'Material', text, files });
	assert.deepEqual(await delivery.list(), [{ id: 'agent', title: 'Agent', agentId: 'codex' }]);
	await assert.rejects(attach('shell', 'page', []), { code: 'missing' });
	await assert.rejects(attach('agent', 'page', []), { code: 'timeout' });
	ready = true;
	await attach('agent', 'page\x1b[201~', ['image.png']);
	assert.equal(pasted.length, 1);
	assert.equal(pasted[0]?.endsWith('\n'), false);
	assert.equal(pasted[0]?.includes('\x1b'), false);
	assert.equal(selected.at(-1), 'agent');
}, 20_000);
test('history is local, deduplicated and bounded; restored state clamps invalid values', () => {
	let history: ReturnType<typeof recordHistory> = [];
	for (let i = 0; i < 520; i++)
		history = recordHistory(history, { url: `https://example.com/${i}`, title: `Title ${i}`, visitedAt: i });
	assert.equal(history.length, 500);
	history = recordHistory(history, { ...history[0]!, title: 'Changed' });
	assert.equal(history.length, 500);
	assert.equal(historySuggestions(history, 'changed')[0]?.title, 'Changed');
	assert.equal(recordHistory(history, { url: 'about:blank', title: '', visitedAt: 0 }), history);
	assert.equal(newPageState('stable', { zoom: 100 }).zoom, 2);
	assert.equal(newPageState('stable', { zoom: NaN }).zoom, 1);
});
test('web shortcuts round trip without changing plain link and embedded web semantics', () => {
	const source =
		'# Board\n\n## Shortcuts\ntype: sticky\n\n### Site\ntype: web\nlink: http://localhost:3000/a?x=1&y=2\nopenIn: tab\n\n### Plain\nlink: https://example.com\n';
	const parsed = parseDashboard(source);
	const card = parsed.columns[0]!.cards[0]!;
	assert.equal(card.type, 'web');
	assert.equal(card.openIn, 'tab');
	assert.equal(parsed.columns[0]!.cards[1]!.type, 'link');
	const again = parseDashboard(serializeDashboard(parsed));
	assert.equal(again.columns[0]!.cards[0]!.url, card.url);
	assert.equal(again.columns[0]!.cards[0]!.openIn, 'tab');
	assert.equal(parseDashboard(source.replace('openIn: tab', '')).columns[0]!.cards[0]!.openIn, 'modal');
});
test('same-page mutations are serialized and closing cancels active and queued work', async () => {
	const q = new BrowserOperationQueue();
	const order: number[] = [];
	let release!: () => void;
	const pending = new Promise<void>((r) => {
		release = r;
	});
	const a = q.run(async () => {
		order.push(1);
		await pending;
		order.push(2);
	});
	const b = q.run(async () => {
		order.push(3);
	});
	await Promise.resolve();
	assert.deepEqual(order, [1]);
	release();
	await Promise.all([a, b]);
	assert.deepEqual(order, [1, 2, 3]);
	const closing = new BrowserOperationQueue();
	const active = closing.run(async (signal) => {
		await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
	});
	const queued = closing.run(async () => assert.fail('Must not execute'));
	await Promise.resolve();
	closing.close();
	closing.close();
	await assert.rejects(active, /browser_page_closed/);
	await assert.rejects(queued, /browser_page_closed/);
});
test('markup geometry, pixel scaling, undo and redo keep immutable history', () => {
	const shape: MarkupShape = {
		kind: 'arrow',
		id: 'a',
		color: '#000',
		width: 4,
		from: { x: 20, y: 40 },
		to: { x: 10, y: 10 },
	};
	const first = commitShape(createMarkupDocument(), shape);
	assert.equal(undoShape(first).shapes.length, 0);
	assert.deepEqual(redoShape(undoShape(first)).shapes, [shape]);
	assert.deepEqual(normalizeRect(shape.from, shape.to), { x: 10, y: 10, width: 10, height: 30 });
	assert.equal(scaleShape(shape, 2).kind, 'arrow');
	assert.equal((scaleShape(shape, 2) as typeof shape).from.x, 40);
	assert.ok(arrowHeadGeometry(shape.from, shape.to, 4));
	assert.equal(arrowHeadGeometry(shape.from, shape.from, 4), null);
	assert.equal(commitShape(undoShape(first), { ...shape, id: 'b' }).future.length, 0);
});
test('AX snapshots disambiguate repeated buttons and bind iframe refs to their CDP session', async () => {
	const nodes = [
		{ nodeId: '1', role: { type: 'role', value: 'RootWebArea' }, childIds: ['2', '3'] },
		...['2', '3'].map((id) => ({
			nodeId: id,
			backendDOMNodeId: Number(id),
			role: { type: 'role', value: 'button' },
			name: { type: 'string', value: 'Submit' },
		})),
	];
	const send = async (method: string) =>
		method === 'Accessibility.getFullAXTree'
			? { nodes }
			: method === 'Runtime.evaluate'
				? { result: { value: [] } }
				: {};
	const snapshot = await buildSnapshot(send, new Map([['frame', 'session']]), () => send);
	assert.ok(snapshot.refs.some((r) => r.name === 'Submit (2nd)'));
	assert.equal(snapshot.refMap.get('@e3')?.sessionId, 'session');
});
test('debugger leases detach only the connection they own and only after last release', () => {
	let attached = false,
		detaches = 0;
	const guest = {
		isDestroyed: () => false,
		debugger: {
			isAttached: () => attached,
			attach: () => {
				attached = true;
			},
			detach: () => {
				attached = false;
				detaches++;
			},
		},
	} as unknown as GuestContents;
	const a = acquireDebugger(guest),
		b = acquireDebugger(guest);
	a();
	assert.equal(attached, true);
	b();
	b();
	assert.equal(detaches, 1);
	attached = true;
	acquireDebugger(guest)();
	assert.equal(attached, true);
	assert.equal(detaches, 1);
});
test('native popup policy returns synchronously, rejects unsafe navigation and cleans up', () => {
	let requestPermission: Function, checkPermission: Function;
	const nativeSession = { storagePath: '/vault/.nand/session', setPermissionRequestHandler: (fn: Function) => { requestPermission = fn; }, setPermissionCheckHandler: (fn: Function) => { checkPermission = fn; } };
	const guest = Object.assign(new EventEmitter(), {
		id: 1, session: nativeSession, getURL: () => 'https://example.com/',
		isDestroyed: () => false,
		getType: () => 'webview',
		getLastWebPreferences: () => ({ nodeIntegration: false }),
		setWindowOpenHandler: (fn: (details: Record<string, string>) => { action: string }) => {
			handler = fn;
		},
	});
	let handler!: (details: Record<string, string>) => { action: string };
	const events: unknown[] = [];
	const exports: {
		install?: (id: number, partition: string, notify: (...args: unknown[]) => void) => { dispose(): void; setGrants(grants: Record<string, boolean>): void };
	} = {};
	let now = 0;
	runInNewContext(GUEST_POLICY_SOURCE, {
		exports,
		require: () => ({ webContents: { fromId: () => guest }, session: { fromPartition: () => nativeSession } }),
		URL,
		Date: { now: () => (now += 300) }, setTimeout: () => 1, clearTimeout: () => {},
	});
	const policy = exports.install!(1, '/vault/.nand/session', (...args) => events.push(args));
	assert.equal(handler({ url: 'https://example.com', frameName: '_blank', features: '' }).action, 'deny');
	assert.equal(events.length, 1);
	assert.equal(
		handler({ url: 'https://example.com/login', frameName: 'oauth', features: 'width=400' }).action,
		'allow',
	);
	assert.equal(handler({ url: 'file:///private', frameName: 'oauth', features: 'width=400' }).action, 'deny');
	let prevented = false;
	guest.emit(
		'will-navigate',
		{
			preventDefault: () => {
				prevented = true;
			},
		},
		'javascript:alert(1)',
	);
	assert.equal(prevented, true);
	assert.equal(checkPermission!(guest, 'media', 'https://example.com'), false);
	policy.setGrants({ 'https://example.com|media': true });
	assert.equal(checkPermission!(guest, 'media', 'https://example.com'), true);
	assert.equal(checkPermission!(guest, 'media', 'https://other.com'), false);
	assert.equal(checkPermission!({ ...guest, id: 99 }, 'media', 'https://example.com'), false);
	requestPermission!(guest, 'geolocation', (granted: boolean) => assert.equal(granted, false), {});
	const childContents = Object.assign(new EventEmitter(), { id: 2, setWindowOpenHandler: () => {}, isDestroyed: () => false });
	let childClosed = false;
	const child = Object.assign(new EventEmitter(), { isDestroyed: () => childClosed });
	Object.defineProperty(child, 'webContents', { get: () => { if (childClosed) throw Error('Object destroyed'); return childContents; } });
	guest.emit('did-create-window', child, { url: 'https://example.com/login' }); childClosed = true;
	assert.doesNotThrow(() => child.emit('closed'), 'Closing popup must not dereference destroyed webContents');
	policy.dispose();
	policy.dispose();
	assert.equal(guest.eventNames().length, 0);
});
