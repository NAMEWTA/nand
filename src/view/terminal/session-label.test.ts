import assert from 'node:assert/strict';
import test from 'node:test';
import { sessionLabel, shortSessionId } from './session-label';

test('short IDs distinguish identical titles and colliding prefixes without depending on order', () => {
	const ids = ['12345678-aaaa', '12345678-abbb', '87654321-cccc'];
	assert.deepEqual(ids.map(id => shortSessionId(id, ids)), ['#12345678-aa', '#12345678-ab', '#87654321']);
	assert.deepEqual(ids.map(id => shortSessionId(id, [...ids].reverse())), ids.map(id => shortSessionId(id, ids)));
	assert.equal(shortSessionId('short', ['short', 'shorter']), '#short');
	assert.equal(shortSessionId('shorter', ['short', 'shorter']), '#shorter');
	const sessions = ids.map(id => ({ id }));
	const before = sessionLabel(sessions[0]!, sessions);
	assert.equal(sessionLabel(sessions[0]!, [sessions[0]!]), before);
});
