import assert from 'node:assert/strict';
import { test } from 'vitest';
import { layoutFor, railAction, rememberTarget } from './layout';
import { normalizeWorkbenchState } from './navigation-state';

test('layout follows the container width; phones always use the drawer', () => {
	assert.equal(layoutFor(1280, false), 'wide');
	assert.equal(layoutFor(960, false), 'wide');
	assert.equal(layoutFor(959, false), 'medium');
	assert.equal(layoutFor(600, false), 'medium');
	assert.equal(layoutFor(599, false), 'narrow');
	assert.equal(layoutFor(1280, true), 'narrow');
});

test('the active rail icon toggles the panel; another icon restores that module’s last route', () => {
	let state = normalizeWorkbenchState({ target: { feature: 'dashboard' } });
	assert.deepEqual(railAction(state, 'dashboard'), { kind: 'toggle-panel' });
	assert.deepEqual(railAction(state, 'contacts'), { kind: 'navigate', target: { feature: 'contacts' } });
	state = rememberTarget(state, { feature: 'contacts', section: 'company' });
	state = rememberTarget(state, { feature: 'dashboard' });
	assert.deepEqual(railAction(state, 'contacts'), { kind: 'navigate', target: { feature: 'contacts', section: 'company' } });
});

test('saved shell state is bounded and keeps per-module routes only for their own module', () => {
	const state = normalizeWorkbenchState({ panelWidth: 999, panelOpen: false, focus: true, lastTargets: { contacts: { feature: 'contacts', section: 'person' }, terminal: { feature: 'browser' }, bogus: {} }, target: { feature: 'settings', section: 'appearance' } });
	assert.equal(state.panelWidth, 360);
	assert.equal(state.panelOpen, false);
	assert.equal(state.focus, true);
	assert.deepEqual(state.lastTargets, { contacts: { feature: 'contacts', section: 'person' } });
	assert.deepEqual(state.target, { feature: 'settings', section: 'appearance' });
	assert.equal(normalizeWorkbenchState({ target: { feature: 'settings', section: 'Bad Id' } }).target.section, undefined);
});
