import assert from 'node:assert/strict';
import { test } from 'node:test';
import { debugLog, errorLog, setDebugMode } from '../../platform/desktop/logger.ts';
import { diagnosticRoots, redactDiagnostic, setDiagnosticRoots } from './redact.ts';

const SECRET = 'NAND_TEST_SECRET_redact';

test('diagnostics drop secrets, absolute homes, and unlisted fields', () => {
	const previous = diagnosticRoots();
	setDiagnosticRoots({ home: '/srv/users/ada', vault: '/srv/users/ada/vault' });
	try {
		const cause = new Error(`token=${SECRET}`);
		const error = new Error('failed under /home/ada/notes/a.md');
		(error as Error & { cause?: unknown }).cause = cause;
		const redacted = redactDiagnostic(error) as { message: string; cause: { message: string }; stack?: string };
		assert.equal(redacted.message.includes(SECRET), false);
		assert.equal(redacted.message.includes('/home/ada'), false);
		assert.match(redacted.message, /<home>/);
		assert.equal(redacted.cause.message.includes(SECRET), false);
		assert.match(redacted.cause.message, /token=<redacted>/);
		assert.equal(redacted.stack?.includes('/home/ada') ?? false, false);

		const url = redactDiagnostic(`GET https://ada:${SECRET}@example.com/path?token=${SECRET}&q=ok`);
		assert.equal(String(url).includes(SECRET), false);
		assert.match(String(url), /token=<redacted>/);
		assert.match(String(url), /q=ok/);

		const record = redactDiagnostic({ token: SECRET, module: 'pty', count: 2, headers: { authorization: SECRET } });
		assert.deepEqual(record, { module: 'pty', count: 2 });

		const vault = redactDiagnostic('read /srv/users/ada/vault/档案/基本信息.md');
		assert.equal(String(vault).includes('/srv/users/ada'), false);
		assert.match(String(vault), /^read <vault>/);

		const loop: { name: string; cause?: unknown } = { name: 'loop' };
		loop.cause = loop;
		assert.equal((redactDiagnostic(loop) as { cause: string }).cause, '<circular>');
		assert.equal(String(redactDiagnostic('x'.repeat(800))).length < 800, true);
	} finally {
		setDiagnosticRoots(previous);
	}
});

test('debug and error logs are redacted without changing the caller string', () => {
	const original = 'echo token stays in the terminal, not here';
	const seen: unknown[][] = [];
	const debug = console.debug;
	const error = console.error;
	console.debug = (...args: unknown[]) => { seen.push(['debug', ...args]); };
	console.error = (...args: unknown[]) => { seen.push(['error', ...args]); };
	setDebugMode(true);
	try {
		debugLog(`token=${SECRET}`, { password: SECRET, module: 'pty' });
		errorLog(new Error(`cookie=${SECRET}`));
		assert.equal(original.includes('echo token stays'), true);
		const flat = JSON.stringify(seen);
		assert.equal(flat.includes(SECRET), false);
		assert.match(flat, /token=<redacted>/);
		assert.match(flat, /cookie=<redacted>/);
	} finally {
		setDebugMode(false);
		console.debug = debug;
		console.error = error;
	}
});
