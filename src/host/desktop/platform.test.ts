import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { test } from 'vitest';
import { getHomeDir, getPlatform, isLinux, isMacOS, isWindows } from './platform';

test('exactly one OS predicate matches the running platform', () => {
	const flags = [isWindows(), isMacOS(), isLinux()].filter(Boolean);
	assert.equal(getPlatform(), process.platform);
	assert.ok(flags.length <= 1);
	assert.equal(isWindows(), process.platform === 'win32');
	assert.equal(isMacOS(), process.platform === 'darwin');
	assert.equal(isLinux(), process.platform === 'linux');
});

test('the home directory comes from the OS', () => {
	assert.equal(getHomeDir(), homedir());
});
