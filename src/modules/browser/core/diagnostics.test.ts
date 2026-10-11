import assert from 'node:assert/strict';
import { test } from 'vitest';
import { consoleDiagnostic, networkDiagnostic } from './diagnostics';

test('diagnostics discard values and nested protocol data instead of guessing which arguments contain secrets', () => {
	const secret = 'fixture-secret-value';
	const result = consoleDiagnostic({ type: 'log', timestamp: 10, args: [
		{ type: 'string', value: secret }, { type: 'object', description: secret, preview: { token: secret } },
		{ type: secret, value: 17 },
	], stackTrace: { url: `https://example.org/?token=${secret}` } });
	assert.deepEqual(result, { type: 'log', timestamp: 10, arguments: [{ type: 'string' }, { type: 'object' }, { type: 'unknown' }] });
	const failed = networkDiagnostic({ type: 'Fetch', timestamp: 11, errorText: 'net::ERR_FAILED', canceled: true, requestId: secret,
		request: { url: `https://example.org/?token=${secret}`, headers: { Cookie: secret }, postData: secret } });
	assert.deepEqual(failed, { type: 'Fetch', timestamp: 11, cancelled: true, error: 'net::ERR_FAILED' });
	assert.equal(JSON.stringify([result, failed]).includes(secret), false);
	assert.deepEqual(networkDiagnostic({ type: secret, timestamp: secret, errorText: secret }), { type: 'unknown', timestamp: undefined, cancelled: false, error: 'failed' });
	assert.equal(consoleDiagnostic({ args: Array.from({ length: 101 }, () => ({ type: 'string', value: secret })) }).arguments.length, 100);
});
