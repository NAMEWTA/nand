import assert from 'node:assert/strict';
import { test } from 'vitest';
import { orderRecentSessions } from './recent-sessions';

test('recent sessions discard deleted IDs and duplicates and keep the active session first', () => {
	const sessions = ['a', 'b', 'c', 'new'].map((id) => ({ id }));
	assert.deepEqual(orderRecentSessions(sessions, ['b', 'gone', 'b', 'c'], 'a').map((s) => s.id), ['a', 'c', 'b', 'new']);
	assert.equal(orderRecentSessions(sessions, ['b'])[0], sessions[1]);
	assert.deepEqual(orderRecentSessions([], ['gone'], 'gone'), []);
});
