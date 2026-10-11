import assert from 'node:assert/strict';
import { test } from 'vitest';
import { markSourceAttempt, nextAdaptiveIntervalMinutes, sourceDue } from './source-schedule';

test('adaptive source intervals use ordinary/signal ceilings and the seven-day daily rate', () => {
	const source = { intervalMinutes: 30, participation: 'editorial' as const };
	assert.equal(nextAdaptiveIntervalMinutes(source, 0), 60);
	assert.equal(nextAdaptiveIntervalMinutes(source, 0.15), 60);
	assert.equal(nextAdaptiveIntervalMinutes(source, 14), 34);
	assert.equal(nextAdaptiveIntervalMinutes(source, 100), 15);
	assert.equal(nextAdaptiveIntervalMinutes({ ...source, participation: 'signal' }, 0), 180);
	assert.equal(nextAdaptiveIntervalMinutes({ ...source, participation: 'signal' }, 14), 34);
});

test('failure backoff grows past the fifth failure, stays bounded, and resets on success', () => {
	const config = { intervalMinutes: 15, participation: 'editorial' as const };
	let health = { failureCount: 0, initializedAt: 1, configHash: 'config', nextDue: 0 };
	for (let failed = 1; failed <= 30; failed++) {
		health = { ...health, ...markSourceAttempt(health, config, 100, false) };
		assert.equal(health.failureCount, failed);
		assert.equal(health.nextDue, 100 + Math.min(360, (failed + 1) * 15) * 60_000);
		assert.equal(sourceDue(health, 100), false);
	}
	const recovered = markSourceAttempt(health, config, 200, true, 14);
	assert.equal(recovered.failureCount, 0);
	assert.equal(recovered.lastSuccess, 200);
	assert.equal(recovered.nextDue, 200 + 34 * 60_000);
});

test('disabling adaptive intervals honors the configured interval and retains failure backoff', () => {
	const source = { intervalMinutes: 45, participation: 'editorial' as const };
	const health = { failureCount: 0, initializedAt: 1, configHash: 'config', intervalMinutes: 15 };
	const success = markSourceAttempt(health, source, 100, true, 100, false);
	assert.equal(success.intervalMinutes, 45); assert.equal(success.nextDue, 100 + 45 * 60_000);
	const failure = markSourceAttempt(success, source, 200, false, 100, false);
	assert.equal(failure.nextDue, 200 + 90 * 60_000);
	assert.equal(markSourceAttempt(failure, source, 300, true, 100, true).intervalMinutes, 15);
});
