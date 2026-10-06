import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runtimeActivity, sessionStatusClass, sessionStatusI18nKey, type SessionStatusSnapshot } from './session-status.ts';

const snapshot = (overrides: Partial<SessionStatusSnapshot> = {}): SessionStatusSnapshot => ({
	generation: 1,
	connection: 'connected',
	agentActivity: 'unknown',
	agent: false,
	...overrides,
});

test('a connected shell is connected, not an unverified or running agent', () => {
	const shell = snapshot();
	assert.equal(sessionStatusI18nKey(shell), 'workbench.connection.connected');
	assert.equal(sessionStatusClass(shell), 'connected');
	assert.equal(runtimeActivity(shell), 'unknown');
	assert.equal(runtimeActivity(snapshot({ agentActivity: 'running' })), 'unknown');
});

test('agent activity stays visible only while that agent is connected', () => {
	assert.equal(sessionStatusI18nKey(snapshot({ agent: true, agentActivity: 'unknown' })), 'workbench.status.unknown');
	assert.equal(sessionStatusI18nKey(snapshot({ agent: true, agentActivity: 'running' })), 'workbench.status.running');
	assert.equal(runtimeActivity(snapshot({ agent: true, agentActivity: 'running' })), 'running');
	assert.equal(sessionStatusI18nKey(snapshot({ agent: true, agentActivity: 'running', connection: 'reconnecting' })), 'workbench.connection.reconnecting');
	assert.equal(runtimeActivity(snapshot({ agent: true, agentActivity: 'running', connection: 'reconnecting' })), 'unknown');
	assert.equal(sessionStatusClass(snapshot({ connection: 'failed' })), 'failed');
});
