import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import type { BrowserControl } from '../api';
import type { BrowserPageAction, BrowserPageTarget } from '../core/control';
import type { ExternalAccessRequest } from '../core/external-access';
import { BrowserError } from '../core/model';
import { PageOwnership } from '../core/page-ownership';
import type { ScopedBrowserPort } from '../core/scoped-grant';
import { BrowserGrants } from './grants';

const target = { pageId: 'page-a', profileId: 'account', generation: 'guest' };
const other = { pageId: 'page-b', profileId: 'other-account', generation: 'guest-b' };
const request = (): ExternalAccessRequest => ({ purpose: 'Read selected page', targets: [target], operations: ['snapshot', 'get'], minutes: 5, maxOperations: 20 });
async function fixture(input = request()) {
	let serial = 0, revision = 0, draft = '', now = 1000, current = target, port!: ScopedBrowserPort;
	const actions: BrowserPageAction[] = [], ownership = new PageOwnership(), timers = new Set<{ at: number; run(): void }>();
	const disconnect = vi.fn(), activate = vi.fn(async () => {}), connected = { entered: false, wait: Promise.resolve() };
	const control: BrowserControl = {
		list: () => [current, other].map(target => ({ target, title: target.pageId, url: 'https://example.org/form', loading: false, error: null })),
		open: async () => target, close: async () => {}, activate, screenshot: async () => '',
		observe: async target => ({ target, url: 'https://example.org/form', revision: String(++revision), snapshot: 'private page value', refs: [{ ref: '@e1', role: 'text input', name: 'Message' }] }),
		readElement: async () => ({ text: draft, value: draft, attributes: {}, tag: 'TEXTAREA' }),
		act: async (_target, action) => { if (action.kind === 'fill') { if (action.expectedValue !== draft) throw new BrowserError('browser_workspace_draft_changed'); draft = action.value; } actions.push(action); return { target: current, operation: action.kind }; },
		reviewAction: async (_target, action) => ({ id: 'review-' + (++serial), target: current, action, expiresAt: now + 60000, pageUrl: 'https://example.org/form', frameUrl: 'https://example.org/form',
			object: { tag: 'BUTTON', name: 'Submit', type: 'submit', role: 'button' }, destination: 'https://example.org/form', method: 'POST', content: 'private page value', fields: [] }),
		actReviewed: async () => { actions.push({ kind: 'click', ref: { revision: String(revision), element: '@e1' } }); return { target: current, operation: 'click' }; },
	};
	const grants = new BrowserGrants({ control, connect: async provided => { port = provided; connected.entered = true; await connected.wait; return { environment: { NAND_BROWSER_TOKEN: 'runtime-only-token' }, dispose: disconnect }; },
		claim: (target, id, signal) => ownership.claim(target, { kind: 'external', id }, signal),
		scopedControl: (permit, lease, signal) => {
			const check = (target: BrowserPageTarget) => { permit.admit(); lease.admit(); if (signal.aborted) throw new BrowserError('browser_scoped_grant_revoked'); if (target.generation !== current.generation) throw new BrowserError('browser_stale_target'); };
			return { ...control, observe: async target => { check(target); return control.observe(target); }, readElement: async (target, ref) => { check(target); return control.readElement(target, ref); },
				act: async (target, action) => { check(target); return control.act(target, action); }, reviewAction: async (target, action) => { check(target); return control.reviewAction(target, action); },
				actReviewed: async (target, id) => { check(target); return control.actReviewed(target, id); } };
		}, accountLabel: id => id, id: () => 'id-' + (++serial), now: () => now, changed: () => {},
		after: (ms, run) => { const timer = { at: now + ms, run }; timers.add(timer); return () => { timers.delete(timer); }; } });
	const issued = await grants.create(input);
	const execute = (method: string, params: Record<string, unknown> = {}, signal = new AbortController().signal) => port.execute(method, { taskId: issued.grant.taskId, page: target.pageId, ...params }, signal);
	return { grants, issued, execute, ownership, actions, activate, disconnect, control, connected, setDraft: (text: string) => { draft = text; }, draft: () => draft,
		replace: () => { current = { ...target, generation: 'new-guest' }; }, advance: (ms: number) => { now += ms; for (const timer of [...timers]) if (timer.at <= now) timer.run(); } };
}

test('external credential authority filters listing and rejects another task/page/profile/operation', async () => {
	const f = await fixture();
	assert.deepEqual((await f.execute('tab.list') as { tabs: Array<{ id: string }> }).tabs.map(page => page.id), ['page-a']);
	for (const params of [{ taskId: 'other-task' }, { page: 'page-b' }, { profileId: 'other-account' }, { generation: 'new-guest' }])
		await assert.rejects(f.execute('snapshot', params), { code: 'browser_scoped_grant_scope' });
	await assert.rejects(f.execute('fill', { value: 'text', expectedValue: '' }), { code: 'browser_scoped_grant_scope' });
	await f.execute('snapshot'); assert.equal(f.activate.mock.calls.length, 0); assert.equal(f.ownership.owner(target), undefined);
	assert.equal(JSON.stringify(f.grants.list()).includes('runtime-only-token'), false); assert.equal(JSON.stringify(f.grants.list()).includes('private page value'), false);
	f.grants.dispose(); assert.equal(f.disconnect.mock.calls.length, 1);
});

test('external fills require a fresh observation and explicit draft guard; a human edit is preserved', async () => {
	const f = await fixture({ ...request(), operations: ['snapshot', 'get', 'fill'] });
	await assert.rejects(f.execute('fill', { value: 'new' }), { code: 'browser_invalid_argument' });
	await assert.rejects(f.execute('fill', { value: 'new', expectedValue: '', revision: 'old', element: '@e1' }), { code: 'browser_stale_ref' });
	const observation = await f.execute('snapshot') as { revision: string }; f.setDraft('human draft');
	await assert.rejects(f.execute('fill', { value: 'new', expectedValue: '', revision: observation.revision, element: '@e1' }), { code: 'browser_workspace_draft_changed' });
	assert.equal(f.draft(), 'human draft'); assert.equal(f.actions.length, 0); f.grants.dispose();
});

test('an existing page owner cannot be displaced and a replaced guest invalidates the grant target', async () => {
	const f = await fixture(), human = new AbortController(), lease = f.ownership.claim(target, { kind: 'workflow', id: 'other-owner' }, human.signal);
	await assert.rejects(f.execute('snapshot'), { code: 'browser_workspace_busy' }); assert.equal(f.ownership.owner(target)?.id, 'other-owner');
	lease.release(); f.replace(); await assert.rejects(f.execute('snapshot'), { code: 'browser_stale_target' });
	assert.deepEqual((await f.execute('tab.list') as { tabs: unknown[] }).tabs, []); f.grants.dispose();
});

test('native final confirmation is one-use; takeover and expiry stop waiting requests without clicking', async () => {
	for (const stop of ['confirm', 'takeover', 'expire', 'headless']) {
		const f = await fixture({ ...request(), operations: ['snapshot', 'click'] });
		const observation = await f.execute('snapshot') as { revision: string };
		const pending = f.execute('click', { revision: observation.revision, element: '@e1' }); void pending.catch(() => {});
		await vi.waitFor(() => assert.equal(f.grants.confirmations(f.issued.grant.id).length, 1));
		const review = f.grants.confirmations(f.issued.grant.id)[0]!;
		if (stop === 'confirm') { f.grants.decide(f.issued.grant.id, review.id, true); await pending; assert.equal(f.actions.length, 1);
			assert.throws(() => f.grants.decide(f.issued.grant.id, review.id, true), { code: 'browser_action_review_changed' }); }
		else { if (stop === 'takeover') await f.grants.takeover(f.issued.grant.id, target); else f.advance(stop === 'expire' ? 300000 : 60000);
			await assert.rejects(pending); assert.equal(f.actions.length, 0); }
		assert.equal(f.ownership.owner(target), undefined); assert.equal(f.grants.confirmations(f.issued.grant.id).length, 0); f.grants.dispose();
	}
});

test('operation exhaustion and revocation stop subsequent requests and retain only symbolic history', async () => {
	const f = await fixture({ ...request(), maxOperations: 1 }); await f.execute('snapshot');
	assert.equal(f.grants.list()[0]!.state, 'exhausted'); await assert.rejects(f.execute('snapshot')); assert.equal(f.disconnect.mock.calls.length, 1);
	assert.ok(f.grants.list()[0]!.events.every(event => event.evidence === undefined)); f.grants.dispose();
	const next = await fixture(); next.grants.revoke(next.issued.grant.id); await assert.rejects(next.execute('tab.list')); next.grants.dispose();
});

test('taking over a page revokes every existing grant for that page and releases all connection capabilities', async () => {
	const f = await fixture(); await f.grants.create(request()); await f.grants.takeover(f.issued.grant.id, target);
	assert.ok(f.grants.list().every(grant => grant.state === 'revoked')); assert.equal(f.disconnect.mock.calls.length, 2); assert.equal(f.activate.mock.calls.length, 1); f.grants.dispose();
});

test('module disposal during connection creation closes a late transport and never hands out credentials', async () => {
	const f = await fixture(); let release!: () => void; f.connected.wait = new Promise<void>(resolve => { release = resolve; }); f.connected.entered = false;
	const pending = f.grants.create(request()); void pending.catch(() => {}); await vi.waitFor(() => assert.equal(f.connected.entered, true));
	f.grants.dispose(); release(); await assert.rejects(pending, { code: 'browser_scoped_grant_revoked' });
	assert.equal(f.disconnect.mock.calls.length, 2); assert.ok(f.grants.list().every(grant => grant.state === 'revoked'));
});
