import assert from 'node:assert/strict';
import { test } from 'vitest';
import { browserShortcut } from '../core/ai-workbench';
import { browserFocusTarget } from './browser-keys';

test('the panel chord follows address and toolbar focus', () => {
	const address = browserFocusTarget({ inside: true, address: true, find: false, toolbar: true, page: false });
	const page = browserFocusTarget({ inside: true, address: false, find: false, toolbar: false, page: true });
	assert.equal(browserShortcut({ key: 'f', mod: true, target: address }), 'find');
	assert.equal(browserShortcut({ key: 'l', mod: true, target: browserFocusTarget({ inside: true, address: false, find: false, toolbar: true, page: false }) }), 'address');
	assert.equal(browserShortcut({ key: 'f', mod: true, target: page }), 'none');
	assert.equal(browserShortcut({ key: 'f', mod: true, target: browserFocusTarget({ inside: false, address: true, find: false, toolbar: false, page: false }) }), 'none');
});
