import test from 'node:test';
import assert from 'node:assert/strict';
import { requiresNamespaceMigration } from './namespace-version.ts';

test('namespace gate distinguishes new installs, migrated data and unsupported existing data', () => {
	assert.equal(requiresNamespaceMigration(null), false);
	assert.equal(requiresNamespaceMigration({ dataNamespaceVersion: 1 }), false);
	for (const value of [{}, { language: 'zh' }, { dataNamespaceVersion: 2 }, [], 'invalid']) {
		assert.equal(requiresNamespaceMigration(value), true);
	}
});
