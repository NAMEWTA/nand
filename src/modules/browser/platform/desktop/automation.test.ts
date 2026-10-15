import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'vitest';
import { BrowserAutomation } from './automation';
import type { BrowserPage } from './page';
import type { GuestContents } from './electron-api';

test('capture tools retain viewport and screenshots and release their native listeners', async () => {
	let attached = false;
	const commands: Array<{ method: string; params: unknown }> = [];
	const debug = Object.assign(new EventEmitter(), {
		isAttached: () => attached, attach: () => { attached = true; }, detach: () => { attached = false; },
		sendCommand: async (method: string, params: unknown) => {
			commands.push({ method, params });
			return method === 'Page.captureScreenshot' ? { data: 'aGVsbG8=' } : {};
		},
	});
	const guest = Object.assign(new EventEmitter(), { isDestroyed: () => false, debugger: debug }) as unknown as GuestContents;
	const page = { state: { id: 'a' }, disposed: false, webview: { win: { setTimeout, clearTimeout }, getBoundingClientRect: () => ({ width: 800 }) } } as unknown as BrowserPage;
	const automation = new BrowserAutomation(guest, page);
	assert.deepEqual(await automation.execute('viewport', { width: 640, height: 480 }), { width: 640, height: 480 });
	assert.ok(commands.some(row => row.method === 'Emulation.setDeviceMetricsOverride'));
	assert.deepEqual(await automation.execute('screenshot', {}), { dataUrl: 'data:image/png;base64,aGVsbG8=' });
	assert.deepEqual(await automation.execute('viewport', {}), { width: 0, height: 0 });
	assert.ok(commands.some(row => row.method === 'Emulation.clearDeviceMetricsOverride'));
	for (const method of ['click', 'fill', 'keypress', 'console', 'network', 'review']) {
		await assert.rejects(automation.execute(method, {}), { code: 'browser_unknown_method' });
	}
	assert.equal(commands.some(row => row.method.startsWith('Input.')), false);
	assert.equal(debug.listenerCount('message'), 1);
	automation.dispose(); automation.dispose();
	assert.equal(debug.listenerCount('message'), 0);
	assert.equal(debug.listenerCount('detach'), 0);
	assert.equal(attached, false);
	await assert.rejects(automation.execute('viewport', {}), /browser_page_closed/);
});
