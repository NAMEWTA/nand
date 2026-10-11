import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { test, vi } from 'vitest';
import { BrowserAutomation } from './automation';
import { READ_ACTION_REVIEW } from './action-review';
import type { BrowserActionReview } from '../../core/control';
import type { BrowserPage } from './page';
import type { GuestContents } from './electron-api';

function fixture() {
	let attached = false, allowed = true, moved: (() => void) | undefined;
	const inputs: Record<string, unknown>[] = [];
	const field = { name: 'message', value: 'Reviewed text', tagName: 'TEXTAREA', id: 'message', isContentEditable: false,
		getAttribute: (key: string) => key === 'type' ? 'text' : null, getClientRects: () => [{}] };
	const form = { innerText: 'Publish to the test destination', action: '/publish',
		getAttribute(key: string) { return key === 'action' ? this.action : key === 'method' ? 'post' : null; },
		querySelectorAll: () => [field] };
	const document: { location: { href: string }; body: typeof form; activeElement?: unknown; elementFromPoint(): unknown } = {
		location: { href: 'https://example.org/editor' }, body: form, elementFromPoint: () => element,
	};
	const element = { isConnected: true, tagName: 'BUTTON', form, innerText: 'Publish', ownerDocument: document,
		getAttribute: (key: string) => key === 'type' ? 'submit' : null, hasAttribute: () => false,
		closest: () => null, getClientRects: () => [{}], getBoundingClientRect: () => ({ x: 10, y: 10, width: 100, height: 40 }),
		contains: (value: unknown) => value === element, focus: () => { document.activeElement = element; } };
	const debug = Object.assign(new EventEmitter(), {
		isAttached: () => attached, attach: () => { attached = true; }, detach: () => { attached = false; },
		sendCommand: async (method: string, params: Record<string, unknown> = {}) => {
			if (method === 'Accessibility.getFullAXTree') return { nodes: [{ nodeId: '1', backendDOMNodeId: 1,
				role: { type: 'role', value: 'button' }, name: { type: 'string', value: 'Publish' } }] };
			if (method === 'Runtime.evaluate') return { result: { value: '[]' } };
			if (method === 'DOM.resolveNode') return { object: { objectId: 'button' } };
			if (method === 'Runtime.callFunctionOn') {
				try {
					const fn = runInNewContext('(' + String(params.functionDeclaration) + ')', { URL, document }) as (...args: unknown[]) => unknown;
					return { result: { value: structuredClone(fn.apply(element, ((params.arguments ?? []) as { value: unknown }[]).map(arg => arg.value))) } };
				} catch { return { exceptionDetails: {} }; }
			}
			if (method === 'Input.dispatchMouseEvent' || method === 'Input.dispatchKeyEvent') {
				inputs.push(params);
				if (params.type === 'mouseMoved') moved?.();
			}
			return {};
		},
	});
	const webview = { win: { setTimeout, clearTimeout }, ownerDocument: { activeElement: null as unknown },
		getBoundingClientRect: () => ({ width: 600 }), focus: () => { webview.ownerDocument.activeElement = webview; } };
	const page = { state: { id: 'a', url: document.location.href }, profileId: 'work', generation: 'guest-one', disposed: false, webview } as unknown as BrowserPage;
	const guest = Object.assign(new EventEmitter(), { isDestroyed: () => false, debugger: debug }) as unknown as GuestContents;
	const automation = new BrowserAutomation(guest, page), admission = () => { if (!allowed) throw Error('revoked'); };
	const review = async (kind: 'click' | 'keypress' = 'click') => {
		const snapshot = await automation.execute('snapshot', {}) as { revision: string };
		return automation.execute('review', { action: { kind, key: 'Enter', ref: { revision: snapshot.revision, element: '@e1' } } }, admission) as Promise<BrowserActionReview>;
	};
	return { automation, review, field, form, page, element, inputs, admission,
		revoke: () => { allowed = false; }, onMoved: (fn: () => void) => { moved = fn; } };
}

test('native review exposes concrete material, executes once and rejects object/action mismatches', async () => {
	const f = fixture();
	try {
		const review = await f.review();
		assert.equal(review.destination, 'https://example.org/publish');
		assert.equal(review.fields[0]!.value, 'Reviewed text');
		assert.equal(review.object.name, 'Publish');
		assert.equal(review.target.profileId, 'work');
		assert.equal(f.inputs.length, 0);
		review.fields[0]!.value = 'caller edit';
		assert.deepEqual(await f.automation.execute('reviewed', { id: review.id, expectedOperation: 'click' }, f.admission), { operation: 'click' });
		assert.equal(f.inputs.filter(input => input.type === 'mousePressed').length, 1);
		await assert.rejects(f.automation.execute('reviewed', { id: review.id }), /browser_action_review_changed/);
		const next = await f.review();
		await assert.rejects(f.automation.execute('reviewed', { id: next.id, expectedOperation: 'keypress' }), /browser_action_review_changed/);
		await assert.rejects(f.automation.execute('reviewed', { id: next.id }), /browser_action_review_changed/);
	} finally { f.automation.dispose(); }
});

test('changed form, destination, detached element and expired confirmation never dispatch an input', async () => {
	for (const mutate of [
		(f: ReturnType<typeof fixture>) => { f.field.value = 'Different content'; },
		(f: ReturnType<typeof fixture>) => { f.form.action = '/other-destination'; },
		(f: ReturnType<typeof fixture>) => { f.element.isConnected = false; },
	]) {
		const f = fixture();
		try { const review = await f.review(); mutate(f);
			await assert.rejects(f.automation.execute('reviewed', { id: review.id }), /browser_action_review_changed|browser_stale_ref/);
			assert.equal(f.inputs.length, 0);
		} finally { f.automation.dispose(); }
	}
	const f = fixture();
	try { const review = await f.review(); const clock = vi.spyOn(Date, 'now').mockReturnValue(review.expiresAt);
		try { await assert.rejects(f.automation.execute('reviewed', { id: review.id }), /browser_action_review_changed/); }
		finally { clock.mockRestore(); }
		assert.equal(f.inputs.length, 0);
	} finally { f.automation.dispose(); }
});

test('changes or revocation after pointer movement are checked again before mouse press', async () => {
	for (const revoke of [false, true]) {
		const f = fixture();
		try { const review = await f.review(); f.onMoved(() => { if (revoke) f.revoke(); else f.field.value = 'Late edit'; });
			await assert.rejects(f.automation.execute('reviewed', { id: review.id }, f.admission), /browser_action_review_changed|revoked/);
			assert.equal(f.inputs.filter(input => input.type === 'mousePressed').length, 0);
		} finally { f.automation.dispose(); }
	}
});

test('keyboard submission shares the final review, while sensitive fields require human handling', async () => {
	const f = fixture();
	try { const review = await f.review('keypress');
		await f.automation.execute('reviewed', { id: review.id, expectedOperation: 'keypress' }, f.admission);
		assert.equal(f.inputs.filter(input => input.type === 'keyDown').length, 1);
		f.field.name = 'password';
		await assert.rejects(f.review(), /browser_element_action_failed/);
		assert.throws(() => (runInNewContext('(' + READ_ACTION_REVIEW + ')', { URL }) as () => unknown).call(f.element), /manual sensitive action/);
	} finally { f.automation.dispose(); }
});
