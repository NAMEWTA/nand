import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import type { BrowserControl } from '../api';
import type { BrowserPageAction } from '../core/control';
import type { BrowserWorkflowSpec } from '../core/workflows/model';
import { BrowserError } from '../core/model';
import { PageOwnership } from '../core/page-ownership';
import { workflowDocuments } from '../core/workflows/documents';
import type { TextStorage } from '../../../shared/storage/ports';
import { WorkflowStore } from '../platform/workflow-store';
import { BrowserWorkflows } from './workflows';

const target = { pageId: 'page', profileId: 'work', generation: 'guest' }, url = 'https://example.org/form/';
const element = { role: 'text input', name: 'Message' };
const scope = [{ id: 'form', pageId: target.pageId, profileId: target.profileId }];
const spec = (): BrowserWorkflowSpec => ({ id: 'form-flow', version: 1, title: 'Fill a form', description: '', createdAt: 1, updatedAt: 1,
	variables: [{ name: 'message', type: 'text', required: true }], targetScope: [{ id: 'form', profileId: 'work', origin: 'https://example.org', pathPrefix: '/form/' }], consequenceClass: 'page-input',
	steps: [{ id: 'fill', target: 'form', operation: 'fill', args: { element, value: '{{message}}' }, precondition: [{ kind: 'value', element, equals: '' }], postcondition: [{ kind: 'value', element, equals: '{{message}}' }] },
		{ id: 'read', target: 'form', operation: 'read', args: { element }, precondition: [{ kind: 'value', element, equals: '{{message}}' }], postcondition: [{ kind: 'value', element, equals: '{{message}}' }] }] });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
async function fixture(definition = spec()) {
	const files = new Map<string, string>(), actions: BrowserPageAction[] = [], ownership = new PageOwnership();
	let serial = 0, revision = 0, draft = '', fail = false, afterAction = async () => {}, currentTarget = { ...target }, currentUrl = url;
	const timers = new Set<() => void>();
	const storage: TextStorage = { exists: async path => files.has(path), read: async path => files.get(path)!, mkdir: async () => {},
		write: async (path, value) => { if (path === 'flows.json' && fail) throw Error('disk full'); files.set(path, value); } };
	const store = new WorkflowStore(storage, 'flows.json', () => {}, '.nand/workflow-recovery');
	const control: BrowserControl = {
		list: () => [{ target: currentTarget, title: 'Form', url: currentUrl, loading: false, error: null }], open: async () => currentTarget, close: async () => {}, activate: async () => {}, screenshot: async () => '',
		observe: async () => ({ target: currentTarget, url: currentUrl, revision: String(++revision), snapshot: `Draft: ${draft}`, refs: [{ ref: '@e1', ...element }, { ref: '@e2', role: 'button', name: 'Submit' }] }),
		readElement: async () => ({ text: draft, tag: 'TEXTAREA', value: draft, attributes: {} }),
		act: async (_target, action) => { if (action.kind === 'fill') { if (draft !== action.expectedValue) throw new BrowserError('browser_workspace_draft_changed'); draft = action.value; }
			actions.push(action); await afterAction(); return { target: currentTarget, operation: action.kind }; },
		reviewAction: async (_target, action) => ({ id: `review-${++serial}`, target: currentTarget, action, expiresAt: Date.now() + 120000, pageUrl: currentUrl, frameUrl: currentUrl,
			object: { tag: 'BUTTON', name: 'Submit', type: 'submit', role: 'button' }, destination: url, method: 'POST', content: draft, fields: [{ name: 'message', type: 'text', value: draft }] }),
		actReviewed: async () => { actions.push({ kind: 'click', ref: { revision: String(revision), element: '@e2' } }); await afterAction(); return { target: currentTarget, operation: 'click' }; },
	};
	const workflows = new BrowserWorkflows({ store, control, owner: () => undefined, accountLabel: () => 'Work', open: async () => {}, artifact: id => `${id}.md`,
		claim: (target, id, signal) => ownership.claim(target, { kind: 'workflow', id }, signal),
		scopedControl: (permit, lease, signal) => {
			const admit = () => { permit.admit(); lease.admit(); if (signal.aborted) throw new BrowserError('browser_scoped_grant_revoked'); };
			return { ...control, observe: async target => { admit(); return control.observe(target); }, readElement: async (target, ref) => { admit(); return control.readElement(target, ref); },
				act: async (target, action) => { admit(); return control.act(target, action); }, actReviewed: async (target, id) => { admit(); return control.actReviewed(target, id); } };
		}, id: () => `id-${++serial}`, now: () => Date.now(), changed: () => {}, after: (_ms, work) => { timers.add(work); return () => { timers.delete(work); }; } });
	await workflows.ready; await workflows.save(definition);
	const run = async (message = 'first') => {
		const review = await workflows.review(definition.id, { message }, scope);
		const runId = `run-${++serial}`;
		const handle = await workflows.start(review.action, { runId, trigger: 'manual', signal: new AbortController().signal, authorizationId: review.id });
		return { handle, runId, review };
	};
	return { workflows, store, files, actions, ownership, timers, control, run, draft: () => draft, setDraft: (value: string) => { draft = value; },
		afterAction: (work: () => Promise<void>) => { afterAction = work; }, fail: (value: boolean) => { fail = value; },
		navigate: (value: string) => { currentUrl = value; }, replaceGuest: () => { currentTarget = { ...currentTarget, generation: 'replacement' }; } };
}

test('a saved finite workflow reuses explicit scope with two variable sets and records pre/post evidence under owner run IDs', async () => {
	const f = await fixture();
	for (const message of ['first', 'second {{literal}}']) {
		f.setDraft(''); const { handle, runId } = await f.run(message); assert.equal((await handle.completion).status, 'succeeded');
		const record = f.workflows.records().find(row => row.runId === runId)!;
		assert.equal(record.result, message); assert.ok(record.steps.every(step => step.state === 'succeeded' && step.precondition.every(c => c.matched) && step.postcondition.every(c => c.matched)));
		await f.workflows.saveVerified(runId); assert.equal(f.workflows.definitions()[0]!.verification?.runId, runId);
	}
	assert.equal(f.actions.length, 2); assert.equal(f.ownership.owner(target), undefined); assert.equal(f.timers.size, 0);
	const documents = workflowDocuments('NAND/AI'); assert.deepEqual(documents.decode(documents.encode(f.store.data())), f.store.data());
	await f.workflows.shutdown();
});

test('runtime secrets never enter persisted inputs, observations, condition evidence, result or recovery', async () => {
	const definition = spec(); definition.variables[0]!.type = 'secret'; const f = await fixture(definition), secret = 'private-runtime-input';
	const { handle, runId } = await f.run(secret); assert.equal((await handle.completion).status, 'succeeded'); assert.equal(f.draft(), secret);
	assert.equal(JSON.stringify([...f.files.values()]).includes(secret), false);
	const record = f.workflows.records().find(row => row.runId === runId)!;
	assert.deepEqual(record.publicInputs, {}); assert.equal(record.result, ''); assert.ok(record.events.every(event => !event.evidence));
	assert.throws(() => workflowDocuments('NAND/AI').encode({ ...f.store.data(), executions: [{ ...record, result: secret }] }), { code: 'browser_workflow_storage' });
	await f.workflows.shutdown();
});

test('pause after dispatch releases ownership; resume checks postconditions without overwriting a human draft or replaying fill', async () => {
	const f = await fixture(), entered = deferred(), release = deferred();
	f.afterAction(async () => { entered.resolve(); await release.promise; });
	const { handle, runId } = await f.run(); await entered.promise;
	f.workflows.pause(runId); assert.equal(f.ownership.owner(target), undefined); f.setDraft('human draft'); release.resolve();
	await vi.waitFor(() => assert.equal(f.workflows.records()[0]!.steps[0]!.state, 'unknown'));
	await f.workflows.resume(runId);
	await vi.waitFor(() => assert.equal(f.workflows.records()[0]!.phase, 'paused'));
	assert.equal(f.actions.length, 1); assert.equal(f.draft(), 'human draft');
	f.setDraft('first'); await f.workflows.resume(runId); assert.equal((await handle.completion).status, 'succeeded');
	assert.equal(f.actions.length, 1); await f.workflows.shutdown();
});

test('final consequence confirmation cannot be bypassed by a manual decline or scheduled run', async () => {
	const definition = spec(); definition.consequenceClass = 'submission'; definition.steps = [{ id: 'click', target: 'form', operation: 'click', args: { element: { role: 'button', name: 'Submit' } },
		precondition: [{ kind: 'exists', element: { role: 'button', name: 'Submit' } }], postcondition: [{ kind: 'exists', element: { role: 'button', name: 'Submit' } }] }];
	const f = await fixture(definition), first = await f.run();
	await vi.waitFor(() => assert.ok(f.workflows.confirmation(first.runId))); f.workflows.decide(first.runId, f.workflows.confirmation(first.runId)!.id, false);
	assert.equal((await first.handle.completion).status, 'failed'); assert.equal(f.actions.length, 0);
	const second = await f.run(); await vi.waitFor(() => assert.ok(f.workflows.confirmation(second.runId)));
	f.workflows.decide(second.runId, f.workflows.confirmation(second.runId)!.id, true); assert.equal((await second.handle.completion).status, 'succeeded'); await f.workflows.saveVerified(second.runId);
	const scheduled = await f.workflows.start(second.review.action, { runId: 'scheduled', trigger: 'scheduled', signal: new AbortController().signal });
	assert.equal((await scheduled.completion).status, 'interrupted'); assert.equal(f.actions.length, 1); assert.equal(f.workflows.confirmation('scheduled'), undefined);
	await f.workflows.shutdown();
});

test('post-dispatch storage failure preserves unknown facts and retry only saves; cancellation prevents subsequent steps', async () => {
	const f = await fixture(); f.afterAction(async () => { f.fail(true); });
	const { handle, runId } = await f.run(); assert.equal((await handle.completion).status, 'interrupted'); assert.equal(f.actions.length, 1);
	assert.equal(f.workflows.unsaved(runId), true); assert.ok(f.workflows.recoveryPath(runId));
	f.fail(false); await f.workflows.retrySave(); assert.equal(f.actions.length, 1); assert.equal(f.workflows.unsaved(runId), false); await f.workflows.shutdown();
	const next = await fixture(), entered = deferred(), release = deferred(); next.afterAction(async () => { entered.resolve(); await release.promise; });
	const running = await next.run(); await entered.promise; const cancel = running.handle.cancel(); release.resolve(); await cancel;
	assert.equal((await running.handle.completion).status, 'cancelled'); assert.equal(next.actions.length, 1); assert.equal(next.workflows.records()[0]!.steps[1]!.state, 'pending'); await next.workflows.shutdown();
});

test('review cannot follow a replacement guest or widened path; definition edits revoke verification and old versions', async () => {
	const f = await fixture(), review = await f.workflows.review('form-flow', { message: 'first' }, scope); f.replaceGuest();
	await assert.rejects(f.workflows.start(review.action, { runId: 'stale', trigger: 'manual', signal: new AbortController().signal, authorizationId: review.id }), { code: 'browser_workspace_preview_changed' });
	f.navigate('https://example.org/admin/'); await assert.rejects(f.workflows.review('form-flow', { message: 'first' }, scope), { code: 'browser_workflow_scope' });
	assert.equal(f.actions.length, 0); await f.workflows.shutdown();
	const next = await fixture(); const complete = await next.run(); await complete.handle.completion; await next.workflows.saveVerified(complete.runId);
	const before = next.workflows.definitions()[0]!, edited = structuredClone(before); edited.title = 'Changed title';
	const saved = await next.workflows.save(edited, before); assert.equal(saved.version, 2); assert.equal(saved.verification, undefined);
	await assert.rejects(next.workflows.validate(complete.review.action), { code: 'browser_workflow_changed' }); await next.workflows.shutdown();
});

test('display ordinals never make a repeated native role/name safe for workflow selection', async () => {
	const f = await fixture(), observe = f.control.observe;
	f.control.observe = async target => { const result = await observe(target); result.refs = [
		{ ref: '@e1', ...element, ambiguous: true }, { ref: '@e2', role: element.role, name: element.name + ' (2nd)', ambiguous: true }]; return result; };
	const { handle } = await f.run(); assert.equal((await handle.completion).status, 'failed'); assert.equal(f.actions.length, 0);
	assert.equal(f.workflows.records()[0]!.errorCode, 'browser_workflow_element'); await f.workflows.shutdown();
});

test('shared owner cancellation and producer revocation retain distinct truthful browser outcomes', async () => {
	for (const reason of ['cancelled', 'module-disabled']) {
		const f = await fixture(), entered = deferred(), release = deferred(); f.afterAction(async () => { entered.resolve(); await release.promise; });
		const review = await f.workflows.review('form-flow', { message: 'first' }, scope), abort = new AbortController();
		const handle = await f.workflows.start(review.action, { runId: 'owned', trigger: 'manual', signal: abort.signal, authorizationId: review.id });
		await entered.promise; abort.abort(reason); release.resolve();
		assert.equal((await handle.completion).status, reason === 'cancelled' ? 'cancelled' : 'interrupted'); assert.equal(f.actions.length, 1); await f.workflows.shutdown();
	}
});

test('failed initial intent persistence stays interrupted after save retry and never acquires a page', async () => {
	const f = await fixture(), review = await f.workflows.review('form-flow', { message: 'first' }, scope); f.fail(true);
	await assert.rejects(f.workflows.start(review.action, { runId: 'never-started', trigger: 'manual', signal: new AbortController().signal, authorizationId: review.id }));
	assert.equal(f.actions.length, 0); assert.equal(f.ownership.owner(target), undefined); assert.equal(f.workflows.records()[0]!.phase, 'interrupted');
	f.fail(false); await f.workflows.retrySave(); assert.equal(f.store.data().executions[0]!.phase, 'interrupted'); assert.equal(f.actions.length, 0); await f.workflows.shutdown();
});
