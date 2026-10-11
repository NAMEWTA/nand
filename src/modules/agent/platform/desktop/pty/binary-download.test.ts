import assert from 'node:assert/strict';
import { requestUrl } from 'obsidian';
import { test, vi } from 'vitest';
import { BinaryError, downloadHelperBytes, RELEASE_BASE } from './binary';

vi.mock('obsidian', () => ({ requestUrl: vi.fn() }));

test('host download distinguishes HTTP, connection and deadline failures without leaking redirect credentials', async () => {
	const request = vi.mocked(requestUrl);
	const url = RELEASE_BASE + '/0.0.1-alpha.1/nand-pty-win32-x64.exe';
	for (const status of [404, 503]) {
		request.mockResolvedValueOnce({ status, headers: {}, arrayBuffer: new ArrayBuffer(0), json: {}, text: '' });
		await assert.rejects(downloadHelperBytes(url, 1024), (error: unknown) => error instanceof BinaryError && error.code === 'http' && error.detail?.status === status && error.detail.url === url);
	}
	for (const [message, code] of [['reset https://signed.example/file?token=private', 'network'], ['net::ERR_TIMED_OUT signed-secret', 'timeout'], ['net::ERR_TOO_MANY_REDIRECTS signed-secret', 'redirects']]) {
		request.mockRejectedValueOnce(new Error(message));
		await assert.rejects(downloadHelperBytes(url, 1024), (error: unknown) => {
			assert.ok(error instanceof BinaryError);
			assert.equal(error.code, code);
			assert.equal(error.detail?.url, url);
			assert.ok(!error.message.includes('private') && !error.message.includes('signed'));
			return true;
		});
	}
	request.mockImplementationOnce(() => new Promise(() => {}) as ReturnType<typeof requestUrl>);
	await assert.rejects(downloadHelperBytes(url, 1024, 20), (error: unknown) => error instanceof BinaryError && error.code === 'timeout');
	request.mockResolvedValueOnce({ status: 200, headers: {}, arrayBuffer: new ArrayBuffer(1025), json: {}, text: '' });
	await assert.rejects(downloadHelperBytes(url, 1024), (error: unknown) => error instanceof BinaryError && error.code === 'tooLarge');
	request.mockResolvedValueOnce({ status: 200, headers: {}, arrayBuffer: new Uint8Array([1, 2, 3]).buffer, json: {}, text: '' });
	assert.deepEqual(await downloadHelperBytes(url, 1024), Buffer.from([1, 2, 3]));
	assert.deepEqual(request.mock.lastCall, [{ url, headers: { 'User-Agent': 'NAND' }, throw: false }]);
});
