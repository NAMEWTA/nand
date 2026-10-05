import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeTarget, normalizeWorkbenchState, targetKey, navigationWidth } from './navigation-state';
import { NavigationTransition } from './navigation-transition';
import { visibleStatuses } from './status-policy';

const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };
test('home is the dashboard, not a second product or settings page', () => {
	for (const value of [null, [], {}, { feature: 'home' }, { feature: 'settings' }]) assert.deepEqual(normalizeTarget(value), { feature: 'dashboard' });
});
test('restoration accepts known sections and excludes unrelated or secret fields', () => {
	assert.deepEqual(normalizeTarget({ feature: 'contacts', section: 'person', resourceId: 'stable-id', token: 'secret', dom: {} }), { feature: 'contacts', section: 'person', resourceId: 'stable-id' });
	assert.deepEqual(normalizeTarget({ feature: 'browser', section: 'history', resourceId: '\u0000bad' }), { feature: 'browser' });
});
test('width and expansion normalization are bounded and deterministic', () => {
	assert.equal(navigationWidth(NaN), 232); assert.equal(navigationWidth(100), 208); assert.equal(navigationWidth(500), 280);
	assert.deepEqual(normalizeWorkbenchState({ expanded: ['contacts', 'contacts', 'unknown'], sidebarOpen: false }).expanded, ['contacts']);
});
test('resource identities cannot collide through separators', () => {
	assert.notEqual(targetKey({ feature: 'contacts', resourceId: 'a:b' }), targetKey({ feature: 'contacts', section: 'a', resourceId: 'b' }));
});
test('latest navigation wins and late completion cannot change selection', async () => {
	const navigation = new NavigationTransition(), first = deferred(); const commits: string[] = [];
	const a = navigation.navigate({ feature: 'dashboard' }, () => first.promise, () => commits.push('a'));
	await navigation.navigate({ feature: 'contacts' }, async () => {}, () => commits.push('b'));
	first.resolve(); assert.equal(await a, false); assert.deepEqual(commits, ['b']);
});
test('repeated targets do not remount or repeat side effects', async () => {
	const navigation = new NavigationTransition(), ready = deferred(); let calls = 0;
	const prepare = () => { calls++; return ready.promise; };
	const a = navigation.navigate({ feature: 'dashboard' }, prepare, () => {});
	const b = navigation.navigate({ feature: 'dashboard' }, prepare, () => {});
	assert.equal(a, b); ready.resolve(); await a;
	await navigation.navigate({ feature: 'dashboard' }, prepare, () => {}); assert.equal(calls, 1);
});
test('returning to the visible page cancels a pending different page', async () => {
	const navigation = new NavigationTransition(), slow = deferred(); const commits: string[] = [];
	await navigation.navigate({ feature: 'dashboard' }, async () => {}, () => commits.push('home'));
	const pending = navigation.navigate({ feature: 'contacts' }, () => slow.promise, () => commits.push('contacts'));
	await navigation.navigate({ feature: 'dashboard' }, async () => {}, () => commits.push('home-again'));
	slow.resolve(); assert.equal(await pending, false); assert.deepEqual(commits, ['home']);
});
test('dispose and module invalidation cancel late requests', async () => {
	for (const action of ['dispose', 'invalidate'] as const) {
		const navigation = new NavigationTransition(), slow = deferred(); let committed = false;
		const pending = navigation.navigate({ feature: 'browser' }, () => slow.promise, () => { committed = true; });
		navigation[action](); slow.resolve(); assert.equal(await pending, false); assert.equal(committed, false);
	}
});
test('genuine failures remain failures and permit retry', async () => {
	const navigation = new NavigationTransition();
	await assert.rejects(navigation.navigate({ feature: 'dashboard' }, async () => { throw new Error('save failed'); }, () => {}), /save failed/);
	assert.equal(await navigation.navigate({ feature: 'dashboard' }, async () => {}, () => {}), true);
});
test('status is empty at idle, deduplicated and prioritizes errors', () => {
	const target = { feature: 'terminal' as const };
	assert.deepEqual(visibleStatuses([]), []);
	assert.deepEqual(visibleStatuses([{ id: 'ok', kind: 'info', label: 'Ready', target }]), []);
	const result = visibleStatuses([{ id: 'run', kind: 'running', label: 'Running', target }, { id: 'error', kind: 'error', label: 'Failed', target }, { id: 'run', kind: 'running', label: 'Running', target }]);
	assert.deepEqual(result.map((item) => item.id), ['error', 'run']);
});
