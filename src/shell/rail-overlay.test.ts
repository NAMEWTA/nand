import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { overlayAfterRail } from './rail-overlay';

describe('rail overlay', () => {
	test('one medium overlay click navigates and closes, and a toggle still toggles', () => {
		assert.equal(overlayAfterRail('medium', false, 'navigated', true), false);
		assert.equal(overlayAfterRail('narrow', false, 'navigated', false), true);
		assert.equal(overlayAfterRail('wide', false, 'navigated', true), true);
		assert.equal(overlayAfterRail('medium', true, 'navigated', true), true);
		assert.equal(overlayAfterRail('medium', false, 'toggled', true), 'toggle');
	});
});
