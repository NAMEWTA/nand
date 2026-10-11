import assert from 'node:assert/strict';
import { test } from 'vitest';
import { adapterMatches, userAdapterDocuments, validateAdapterDefinition, validateUserAdapters, type UserAdapter } from './user-adapter';

const candidate: UserAdapter = { id: 'rule', title: 'Explicit selectors', provider: 'deepseek', origin: 'https://chat.deepseek.com', profileScope: 'personal',
	pathPattern: '/a/chat/*', selectors: { composer: '#composer', submit: '#send', answer: '.answer' }, version: 1, createdAt: 1, updatedAt: 1, state: 'candidate' };
test('adapter scope is exact official origin/account and normalized pathname; enabled records require versioned verification', () => {
	assert.equal(adapterMatches(candidate, { provider: 'deepseek', profileId: 'personal' }, 'https://chat.deepseek.com/a/chat/s/123?x=1'), true);
	for (const url of ['https://chat.deepseek.com.evil.test/a/chat/s/123', 'https://user:secret@chat.deepseek.com/a/chat/s/123', 'https://chat.deepseek.com/login'])
		assert.equal(adapterMatches(candidate, { provider: 'deepseek', profileId: 'personal' }, url), false);
	assert.equal(adapterMatches(candidate, { provider: 'deepseek', profileId: 'work' }, 'https://chat.deepseek.com/a/chat/s/123'), false);
	for (const pathPattern of ['//evil.test/*', '/a/../*', '/a?x=*', '/a/*/b', '/a\\b']) assert.throws(() => validateAdapterDefinition({ ...candidate, pathPattern }));
	assert.throws(() => validateUserAdapters({ version: 1, rules: [{ ...candidate, state: 'enabled' }] }), /adapter_invalid/);
	assert.throws(() => validateUserAdapters({ version: 1, rules: [{ ...candidate, verification: { version: 2 } }] }), /adapter_invalid/);
	const codec = userAdapterDocuments('Workspace'), documents = codec.encode({ version: 1, rules: [candidate] });
	assert.ok(documents[0]!.path.endsWith('/rule.md')); assert.deepEqual(codec.decode(documents).rules, [candidate]);
});
