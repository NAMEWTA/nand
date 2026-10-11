import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { AgentPromptRequest, AgentPromptResult } from '../../agent/api';
import type { BrowserControl } from '../api';
import type { BrowserPageAction } from '../core/control';
import { PageOwnership } from '../core/page-ownership';
import type { ScopedBrowserPort } from '../core/scoped-grant';
import type { TextStorage } from '../../../shared/storage/ports';
import { AssistantStore } from '../platform/assistant-store';
import { ScopedBrowserRuns } from './scoped-runs';
import { WebAssistant, type AssistantRequest } from './assistant';
import type { AssistantTask } from '../core/assistant/model';

const target = { pageId: 'page', profileId: 'work', generation: 'guest' };
const request = (): AssistantRequest => ({ title: 'Complete a local draft', goal: 'Fill the approved form.', targets: [target], operations: ['snapshot', 'fill', 'click', 'tab.switch'],
	maxOperations: 20, timeoutMs: 300000, destination: { kind: 'automatic', agentId: 'codex' } });
async function fixture(initial?: AssistantTask[]) {
	const files = new Map<string, string>(), actions: BrowserPageAction[] = [], calls: AgentPromptRequest[] = [];
	if (initial) files.set('assistant.json', JSON.stringify({ version: 1, tasks: initial }));
	let serial = initial ? 100 : 0, now = 1000, failure = false, dispatches = 0, contextsCreated = 0, revision = 0, leaseReleased = 0;
	let runOwner: (request: AgentPromptRequest, port: ScopedBrowserPort) => Promise<AgentPromptResult> = async () => ({ status: 'succeeded', text: 'Finished with observations.' });
	const timers = new Map<number, { at: number; work(): void }>();
	const storage: TextStorage = { exists: async path => files.has(path), read: async path => files.get(path)!, mkdir: async () => {},
		write: async (path, value) => { if (path === 'assistant.json' && failure) throw Error('disk full'); files.set(path, value); } };
	const store = new AssistantStore(storage, 'assistant.json', () => {}, '.nand/recovery/assistant', () => `recovery-${++serial}`);
	const ownership = new PageOwnership();
	let port: ScopedBrowserPort | undefined;
	const contexts = new ScopedBrowserRuns({ id: () => `handle-${++serial}`, now: () => now,
		connect: async next => { contextsCreated++; port = next; return { environment: { NAND_BROWSER_TOKEN: 'only-owner-environment' }, dispose: () => { leaseReleased++; } }; } });
	const control: BrowserControl = {
		list: () => [{ target, title: 'Form', url: 'https://example.org/form', loading: false, error: null }], open: async () => target, close: async () => {}, activate: async () => {}, screenshot: async () => '',
		observe: async () => ({ target, url: 'https://example.org/form', revision: String(++revision), snapshot: 'Form with draft', refs: [{ ref: '@e1', role: 'textbox', name: 'Draft' }] }),
		readElement: async () => ({ text: '', tag: 'TEXTAREA', value: 'draft', attributes: {} }),
		act: async (_target, action) => { actions.push(action); return { target, operation: action.kind }; },
		reviewAction: async (_target, action) => ({ id: `review-${++serial}`, target, action, expiresAt: now + 120000, pageUrl: 'https://example.org/form', frameUrl: 'https://example.org/form',
			object: { tag: 'BUTTON', name: 'Publish', type: 'submit', role: 'button' }, destination: 'https://example.org/publish', method: 'POST', content: 'Actual draft', fields: [{ name: 'Audience', type: 'text', value: 'Test audience' }] }),
		actReviewed: async () => { actions.push({ kind: 'click', ref: { revision: String(revision), element: '@e1' } }); return { target, operation: 'click' }; },
	};
	const build = () => new WebAssistant({ store, control, contexts: async () => contexts, claim: (target, id, signal) => ownership.claim(target, { kind: 'assistant', id }, signal),
		scopedControl: (permit, lease, signal) => {
			const admit = () => { permit.admit(); lease.admit(); if (signal.aborted) throw Error('cancelled'); };
			return { ...control, act: async (target, action) => { admit(); return control.act(target, action); },
				actReviewed: async (target, id) => { admit(); return control.actReviewed(target, id); }, observe: async target => { admit(); return control.observe(target); } };
		}, accountLabel: () => 'Work', id: () => `id-${++serial}`, now: () => now, changed: () => {},
		after: (ms, work) => { const id = ++serial; timers.set(id, { at: now + ms, work }); return () => { timers.delete(id); }; },
		agents: { directory: () => ({ list: () => [{ id: 'codex', title: 'Codex', enabled: true, installed: true }] }),
			sessions: () => ({ list: async () => [{ id: 'manual', title: 'Existing session', agentId: 'codex' }], attachMaterial: async () => {} }),
			dispatch: () => ({ dispatch: async request => { dispatches++; return { invocationId: request.invocationId, delivery: 'pasted', terminalId: 'manual' }; } }),
			runner: () => ({ run: async request => { calls.push(request); const context = request.runContext!;
				const lease = await contexts.resolve(context.handle, { runId: `owner-${calls.length}`, cwd: '/vault', signal: request.signal! });
				assert.equal(lease?.env.NAND_BROWSER_TOKEN, 'only-owner-environment');
				try { return await runOwner(request, port!); } finally { await lease?.dispose(); }
			} }),
		} });
	const assistant = build(); await assistant.ready;
	return { assistant, store, storage, files, control, ownership, contexts, actions, calls, timers, port: () => port!,
		counts: () => ({ dispatches, contextsCreated, leaseReleased }), owner: (fn: typeof runOwner) => { runOwner = fn; },
		fail: (value: boolean) => { failure = value; }, tick: (ms: number) => { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.work(); } } };
}
async function until(check: () => boolean): Promise<void> { for (let i = 0; i < 100 && !check(); i++) await new Promise(resolve => setTimeout(resolve, 0)); assert.ok(check()); }

test('one reviewed task calls the public owner once, uses one scoped handle and saves native evidence separately', async () => {
	const f = await fixture();
	f.owner(async (request, port) => {
		assert.equal(JSON.parse(f.files.get('assistant.json')!).tasks[0].status, 'pending');
		assert.equal(request.prompt.includes('only-owner-environment'), false);
		const snapshot = await port.execute('snapshot', { page: 'page' }, request.signal!) as { revision: string };
		await port.execute('fill', { page: 'page', revision: snapshot.revision, element: '@e1', value: 'Draft only' }, request.signal!);
		return { status: 'succeeded', text: 'Draft filled; no submission.', usage: { input: 12, output: 7, cacheRead: 0, cacheWrite: 0, cost: null, known: true } };
	});
	const review = await f.assistant.review(request()), running = f.assistant.start(review.id);
	await assert.rejects(f.assistant.start(review.id), /preview_changed/); await running;
	assert.equal(f.calls.length, 1); assert.equal(f.counts().dispatches, 0); assert.equal(f.counts().leaseReleased, 1);
	assert.equal(f.assistant.records()[0]!.steps.length, 2); assert.equal(f.assistant.records()[0]!.text, 'Draft filled; no submission.');
	assert.equal(f.actions.length, 1); assert.equal(f.ownership.owner(target), undefined);
	assert.equal(f.assistant.records()[0]!.usage?.output, 7); assert.equal(JSON.parse(f.files.get('assistant.json')!).tasks[0].usage.input, 12);
	assert.equal(JSON.stringify([...f.files.values()]).includes('only-owner-environment'), false);
	await assert.rejects(f.port().execute('snapshot', { page: 'page' }, new AbortController().signal), /revoked/);
	assert.equal(f.timers.size, 0); await f.assistant.shutdown(); f.contexts.dispose();
});

test('declined exact consequence does not dispatch and cannot be confirmed later', async () => {
	const f = await fixture(); f.owner(async (request, port) => {
		const snapshot = await port.execute('snapshot', { page: 'page' }, request.signal!) as { revision: string };
		await assert.rejects(port.execute('click', { page: 'page', revision: snapshot.revision, element: '@e1' }, request.signal!), /action_denied/);
		return { status: 'succeeded', text: 'User declined publication.' };
	});
	const review = await f.assistant.review(request()), running = f.assistant.start(review.id);
	await until(() => !!f.assistant.confirmation(review.id)); const decision = f.assistant.confirmation(review.id)!;
	assert.equal(decision.review.fields[0]!.value, 'Test audience');
	f.assistant.decide(review.id, decision.review.id, false); await running;
	assert.equal(f.actions.length, 0); assert.equal(f.assistant.records()[0]!.steps.at(-1)!.state, 'denied');
	assert.throws(() => f.assistant.decide(review.id, decision.review.id, true), /review_changed/);
	await f.assistant.shutdown(); f.contexts.dispose();
});

test('manual existing delivery remains a paste and never obtains browser credentials or starts the runner', async () => {
	const f = await fixture(), req = request(); req.destination = { kind: 'existing', agentId: 'codex', sessionId: 'manual', sessionTitle: 'old label' };
	const review = await f.assistant.review(req); assert.equal(review.destination.kind === 'existing' && review.destination.sessionTitle, 'Existing session');
	assert.match(review.prompt, /No browser grant is attached/); await f.assistant.start(review.id);
	assert.equal(f.calls.length, 0); assert.equal(f.counts().contextsCreated, 0); assert.equal(f.counts().dispatches, 1);
	assert.equal(f.assistant.records()[0]!.status, 'pasted'); assert.equal(f.assistant.records()[0]!.text, '');
	await f.assistant.shutdown(); f.contexts.dispose();
});

test('failed initial intent saves no owner execution; retry persists the failure without rerunning', async () => {
	const f = await fixture(), review = await f.assistant.review(request()); f.fail(true);
	await assert.rejects(f.assistant.start(review.id), /save_pending/);
	assert.equal(f.calls.length, 0); assert.equal(f.assistant.records()[0]!.status, 'failed'); assert.equal(f.assistant.unsaved(review.id), true);
	assert.ok(f.assistant.recoveryPath(review.id));
	f.fail(false); await f.assistant.retrySave(); assert.equal(f.calls.length, 0); assert.equal(f.assistant.unsaved(review.id), false);
	assert.equal(JSON.parse(f.files.get('assistant.json')!).tasks[0].status, 'failed');
	await f.assistant.shutdown(); f.contexts.dispose();
});

test('pause, timeout and shutdown immediately revoke the task lease and grant, retaining truthful final status', async () => {
	for (const stop of ['pause', 'timeout', 'shutdown'] as const) {
		const f = await fixture(); f.owner(async request => new Promise(resolve => {
			request.signal!.addEventListener('abort', () => resolve({ status: 'cancelled', text: 'Partial owner output' }), { once: true });
		}));
		const review = await f.assistant.review(request()), running = f.assistant.start(review.id); await until(() => f.calls.length === 1);
		assert.equal(f.ownership.owner(target)?.kind, 'assistant');
		let shutting: Promise<void> | undefined;
		if (stop === 'pause') await f.assistant.takeover(review.id, target);
		else if (stop === 'timeout') f.tick(300000);
		else shutting = f.assistant.shutdown();
		assert.equal(f.ownership.owner(target), undefined);
		await assert.rejects(f.port().execute('snapshot', { page: 'page' }, new AbortController().signal), /revoked/);
		await running; await shutting;
		assert.equal(f.assistant.records()[0]!.status, stop === 'pause' ? 'paused' : stop === 'timeout' ? 'timeout' : 'cancelled');
		assert.equal(f.timers.size, 0); if (!shutting) await f.assistant.shutdown(); f.contexts.dispose();
	}
});

test('the visible operation limit stops the owner after the last recorded operation without implicit retries', async () => {
	const f = await fixture(); f.owner(async (request, port) => {
		await port.execute('snapshot', { page: 'page' }, request.signal!);
		assert.equal(request.signal!.aborted, true);
		await assert.rejects(port.execute('snapshot', { page: 'page' }, new AbortController().signal), /revoked/);
		return { status: 'cancelled', text: 'Operation budget reached after observation.' };
	});
	const req = request(); req.maxOperations = 1;
	const review = await f.assistant.review(req); await f.assistant.start(review.id);
	const result = f.assistant.records()[0]!;
	assert.equal(f.calls.length, 1); assert.equal(result.status, 'failed'); assert.equal(result.errorCode, 'browser_scoped_grant_limit');
	assert.equal(result.steps.length, 1); assert.equal(result.steps[0]!.state, 'returned');
	await f.assistant.shutdown(); f.contexts.dispose();
});

test('restart preserves unfinished evidence as unknown and never resolves a context or starts an owner', async () => {
	const f = await fixture(), record = await f.assistant.review(request()); await f.assistant.shutdown(); f.contexts.dispose();
	record.status = 'confirming'; record.steps = [{ id: 'pending-step', target, operation: 'click', startedAt: 1000, state: 'confirming' }];
	const restarted = await fixture([record]);
	assert.equal(restarted.calls.length, 0); assert.equal(restarted.counts().contextsCreated, 0);
	const restored = restarted.assistant.records()[0]!;
	assert.equal(restored.status, 'interrupted'); assert.equal(restored.steps[0]!.state, 'unknown');
	assert.equal(restarted.assistant.confirmation(record.id), undefined);
	const next = await restarted.assistant.review({ ...request(), previousTaskId: record.id });
	assert.notEqual(next.id, record.id); assert.match(next.prompt, /Re-observe current pages/); assert.equal(restarted.calls.length, 0);
	await restarted.assistant.shutdown(); restarted.contexts.dispose();
});

test('human takeover cancels a pending consequence and a late approval cannot send the action', async () => {
	const f = await fixture(); f.owner(async (request, port) => {
		const snapshot = await port.execute('snapshot', { page: 'page' }, request.signal!) as { revision: string };
		await assert.rejects(port.execute('click', { page: 'page', revision: snapshot.revision, element: '@e1' }, request.signal!), /action_denied|revoked/);
		return { status: 'cancelled', text: 'Control handed back.' };
	});
	const review = await f.assistant.review(request()), running = f.assistant.start(review.id);
	await until(() => !!f.assistant.confirmation(review.id)); const decision = f.assistant.confirmation(review.id)!;
	await f.assistant.takeover(review.id, target);
	assert.throws(() => f.assistant.decide(review.id, decision.review.id, true), /review_changed/);
	await running; assert.equal(f.actions.length, 0); assert.equal(f.assistant.records()[0]!.status, 'paused');
	assert.equal(f.timers.size, 0); await f.assistant.shutdown(); f.contexts.dispose();
});
