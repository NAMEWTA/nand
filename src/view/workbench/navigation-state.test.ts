import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeTarget, normalizeWorkbenchState, targetKey, navigationWidth } from './navigation-state';
import { NavigationTransition } from './navigation-transition';
import { createBoardSwitchQueue } from './board-switch';
import { workbenchBoardSettings, workbenchBoardSettingsPatch } from './board-settings';
import { dashboardSaveStatuses, headerStatuses, visibleStatuses } from './status-policy';
import { splitLeafState } from './split-state';


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
test('returning to the visible page cancels a pending different page and applies the return', async () => {
	const navigation = new NavigationTransition(), slow = deferred(); const commits: string[] = [];
	await navigation.navigate({ feature: 'dashboard' }, async () => {}, () => commits.push('home'));
	const pending = navigation.navigate({ feature: 'contacts' }, () => slow.promise, () => commits.push('contacts'));
	await navigation.navigate({ feature: 'dashboard' }, async () => {}, () => commits.push('home-again'));
	slow.resolve(); assert.equal(await pending, false); assert.deepEqual(commits, ['home', 'home-again']);
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
test('a repeated target still skips when nothing is in flight and the live target matches', async () => {
	const navigation = new NavigationTransition();
	let calls = 0;
	let selected = '';
	const live = () => selected ? targetKey({ feature: 'contacts', resourceId: selected }) : undefined;
	const open = () => navigation.navigate({ feature: 'contacts', resourceId: 'X' }, async () => { calls++; selected = 'X'; }, () => {}, live);
	await open();
	await open();
	assert.equal(calls, 1);
	assert.equal(selected, 'X');
});

test('source X then related Y then source X runs prepare again on the same surface', async () => {
	const navigation = new NavigationTransition();
	let surfaces = 0;
	let selected = '';
	const live = () => selected ? targetKey({ feature: 'contacts', section: 'person', resourceId: selected }) : undefined;
	const open = (id: string) => navigation.navigate({ feature: 'contacts', section: 'person', resourceId: id }, async () => {
		if (surfaces === 0) surfaces++;
		selected = id;
	}, () => {}, live);
	assert.equal(await open('X'), true);
	selected = 'Y';
	assert.equal(await open('X'), true);
	assert.equal(selected, 'X');
	assert.equal(surfaces, 1);
});

const gate = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };

test('A to B to A restores the board after the cancelled switch finishes its IO', async () => {
	let path = 'A';
	const writes: string[] = [], saves: string[] = [], gates: Array<ReturnType<typeof gate>> = [];
	const queue = createBoardSwitchQueue({
		current: () => path,
		assign: (next) => { path = next; },
		exists: (candidate) => candidate !== 'missing',
		reload: async () => { writes.push(path); const pending = gate(); gates.push(pending); await pending.promise; },
		missing: () => new Error('missing board'),
		save: () => saves.push(path),
	});
	const navigation = new NavigationTransition();
	const committed: string[] = [];
	const go = (id: string) => navigation.navigate({ feature: 'dashboard', resourceId: id }, (signal) => queue(id, signal), () => committed.push(path), () => targetKey({ feature: 'dashboard', resourceId: path }));
	assert.equal(await go('A'), true);
	const pending = go('B');
	await new Promise((done) => setImmediate(done));
	assert.equal(path, 'B');
	const back = go('A');
	assert.equal(gates.length, 1);
	gates[0]!.resolve();
	await new Promise((done) => setImmediate(done));
	assert.equal(gates.length, 2);
	gates[1]!.resolve();
	assert.equal(await pending, false);
	assert.equal(await back, true);
	assert.equal(path, 'A');
	assert.deepEqual(writes, ['B', 'A']);
	assert.deepEqual(committed, ['A']);
	assert.deepEqual(saves, []);
});

test('A to B to C commits only the latest board', async () => {
	let path = 'A';
	const writes: string[] = [];
	const gates: Array<ReturnType<typeof gate>> = [];
	const queue = createBoardSwitchQueue({
		current: () => path,
		assign: (next) => { path = next; },
		exists: (candidate) => candidate !== 'missing',
		reload: async () => {
			writes.push(path);
			const pending = gate(); gates.push(pending); await pending.promise;
		},
		missing: () => new Error('missing board'),
		save: () => {},
	});
	const navigation = new NavigationTransition();
	const committed: string[] = [];
	const go = (id: string) => navigation.navigate({ feature: 'dashboard', resourceId: id }, (signal) => queue(id, signal), () => committed.push(path), () => targetKey({ feature: 'dashboard', resourceId: path }));
	const pending = go('B');
	await new Promise((done) => setImmediate(done));
	const next = go('C');
	gates[0]!.resolve();
	await new Promise((done) => setImmediate(done));
	gates[1]!.resolve();
	await new Promise((done) => setImmediate(done));
	gates[2]!.resolve();
	assert.equal(await pending, false);
	assert.equal(await next, true);
	assert.equal(path, 'C');
	assert.deepEqual(committed, ['C']);
	assert.deepEqual(writes, ['B', 'A', 'C']);
});

test('a failed or missing board switch restores the previous path and later switches still run', async () => {
	let path = 'A';
	const queue = createBoardSwitchQueue({
		current: () => path,
		assign: (next) => { path = next; },
		exists: (candidate) => candidate !== 'missing',
		reload: async () => { if (path === 'bad') throw new Error('write failed'); },
		missing: () => new Error('missing board'),
		save: () => {},
	});
	await assert.rejects(queue('bad'), /write failed/);
	assert.equal(path, 'A');
	await assert.rejects(queue('missing'), /missing board/);
	assert.equal(path, 'A');
	await queue('C');
	assert.equal(path, 'C');
});

test('invalidating navigation while a board switch is waiting restores the previous board', async () => {
	let path = 'A';
	const gates: Array<ReturnType<typeof gate>> = [];
	const queue = createBoardSwitchQueue({
		current: () => path, assign: (next) => { path = next; }, exists: () => true,
		reload: async () => { const pending = gate(); gates.push(pending); await pending.promise; },
		missing: () => new Error('missing'), save: () => {},
	});
	const navigation = new NavigationTransition();
	let committed = false;
	const pending = navigation.navigate({ feature: 'dashboard', resourceId: 'B' }, (signal) => queue('B', signal), () => { committed = true; });
	await new Promise((done) => setImmediate(done));
	navigation.invalidate();
	gates[0]!.resolve();
	await new Promise((done) => setImmediate(done));
	gates[1]!.resolve();
	assert.equal(await pending, false);
	assert.equal(committed, false);
	assert.equal(path, 'A');
});

test('a browser split copies the page and mints a new id without session secrets', () => {
	const id = 'page-1';
	const split = splitLeafState({ feature: 'browser', resourceId: id }, { id, url: 'https://example.test/a', title: 'A', zoom: 1.25, scroll: { x: 0, y: 40 }, cookie: 'nope', token: 'nope' });
	assert.equal(split.target.feature, 'browser');
	assert.notEqual(split.target.resourceId, id);
	assert.equal(split.pages[0]?.target.resourceId, split.target.resourceId);
	assert.equal(split.pages[0]?.state.url, 'https://example.test/a');
	assert.equal(split.pages[0]?.state.zoom, 1.25);
	assert.deepEqual(split.pages[0]?.state.scroll, { x: 0, y: 40 });
	assert.equal(split.pages[0]?.state.id, split.target.resourceId);
	assert.equal(Object.prototype.hasOwnProperty.call(split.pages[0]?.state ?? {}, 'cookie'), false);
	assert.equal(Object.prototype.hasOwnProperty.call(split.pages[0]?.state ?? {}, 'token'), false);
	const contacts = splitLeafState({ feature: 'contacts', section: 'person', resourceId: 'person-a' }, { selectedId: 'person-a', query: { kind: 'person' } });
	assert.equal(contacts.target.resourceId, 'person-a');
	assert.equal((contacts.pages[0]?.state as { selectedId: string }).selectedId, 'person-a');
});

test('a window without a native status bar keeps the filtered rows and save errors stay on their board', () => {
	const rows = [{ id: 'run', kind: 'running' as const, label: 'Running', target: { feature: 'automations' as const } }];
	assert.deepEqual(headerStatuses(true, rows), []);
	assert.deepEqual(headerStatuses(false, rows), rows);
	const statuses = dashboardSaveStatuses([
		{ path: 'alpha', status: 'saved', message: '' },
		{ path: 'alpha', status: 'saving', message: 'saving' },
		{ path: 'alpha', status: 'conflict-saved', message: 'conflict on alpha' },
		{ path: 'alpha', status: 'save-error', message: 'again' },
		{ path: 'beta', status: 'save-error', message: 'write failed' },
		{ path: '', status: 'save-error', message: 'no path' },
	]);
	assert.deepEqual(statuses.map((item) => item.id), ['dashboard-save:alpha', 'dashboard-save:beta']);
	assert.equal(statuses[0]?.target.resourceId, 'alpha');
	assert.equal(statuses[1]?.target.resourceId, 'beta');
	assert.equal(statuses[0]?.kind, 'error');
	assert.equal(statuses[0]?.label, 'conflict on alpha');
});

test('the workbench home forces stacked without writing that choice back', () => {
	const stored = { dashboardFile: 'board', layoutMode: 'side', modules: { dashboard: true }, quickActions: ['open'], widgetOrder: ['recent', 'tools'] };
	const projected = workbenchBoardSettings(stored, 'other');
	assert.equal(projected.layoutMode, 'stacked');
	assert.equal(projected.dashboardFile, 'other');
	assert.deepEqual(projected.quickActions, ['open']);
	assert.deepEqual(projected.widgetOrder, ['recent', 'tools']);
	assert.equal(stored.layoutMode, 'side');
	const patch = workbenchBoardSettingsPatch({ ...projected, theme: 'ink' });
	assert.equal(Object.prototype.hasOwnProperty.call(patch, 'layoutMode'), false);
	assert.equal(Object.prototype.hasOwnProperty.call(patch, 'dashboardFile'), false);
	assert.equal(Object.prototype.hasOwnProperty.call(patch, 'modules'), false);
	const next = { ...stored, ...patch };
	assert.equal(next.layoutMode, 'side');
	assert.equal(next.dashboardFile, 'board');
	assert.equal(next.theme, 'ink');
});

test('status is empty at idle, deduplicated and prioritizes errors', () => {
	const target = { feature: 'terminal' as const };
	assert.deepEqual(visibleStatuses([]), []);
	assert.deepEqual(visibleStatuses([{ id: 'ok', kind: 'info', label: 'Ready', target }]), []);
	const result = visibleStatuses([{ id: 'run', kind: 'running', label: 'Running', target }, { id: 'error', kind: 'error', label: 'Failed', target }, { id: 'run', kind: 'running', label: 'Running', target }]);
	assert.deepEqual(result.map((item) => item.id), ['error', 'run']);
});
