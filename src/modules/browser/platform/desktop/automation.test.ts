import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'vitest';
import { BrowserAutomation } from './automation';
import type { BrowserPage } from './page';
import type { GuestContents } from './electron-api';

test('native diagnostic listener stores only summaries and releases retained history with its guest', async () => {
	let attached = false;
	const debug = Object.assign(new EventEmitter(), {
		isAttached: () => attached, attach: () => { attached = true; }, detach: () => { attached = false; },
		sendCommand: async () => ({}),
	});
	const guest = Object.assign(new EventEmitter(), { isDestroyed: () => false, debugger: debug }) as unknown as GuestContents;
	const page = { state: { id: 'a' }, disposed: false, webview: { win: { setTimeout, clearTimeout } } } as unknown as BrowserPage;
	const automation = new BrowserAutomation(guest, page);
	assert.deepEqual(await automation.execute('console', {}), []);
	assert.equal(debug.listenerCount('message'), 1);
	const secret = 'fixture-private-value';
	debug.emit('message', {}, 'Runtime.consoleAPICalled', { type: 'error', args: [{ type: 'string', value: secret }] });
	debug.emit('message', {}, 'Network.loadingFailed', { type: 'Fetch', errorText: secret, requestId: secret });
	assert.equal(JSON.stringify(await automation.execute('console', {})).includes(secret), false);
	assert.equal(JSON.stringify(await automation.execute('network', {})).includes(secret), false);
	assert.equal(automation.consoleMessages.length, 1);
	automation.dispose(); automation.dispose();
	assert.equal(debug.listenerCount('message'), 0);
	assert.equal(debug.listenerCount('detach'), 0);
	assert.equal(attached, false);
	assert.deepEqual(automation.consoleMessages, []);
	assert.deepEqual(automation.networkFailures, []);
	await assert.rejects(automation.execute('console', {}), /browser_page_closed/);
});
