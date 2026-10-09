import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, test } from 'vitest';
import { BinaryError, downloadHelperBytes } from './binary';

describe('helper download errors', () => {
	test('an HTTP status is not a network failure, and a refused port is a network failure', async () => {
		const server = createServer((_request, response) => {
			response.writeHead(404);
			response.end('missing');
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const port = (server.address() as AddressInfo).port;
		try {
			await assert.rejects(downloadHelperBytes(`http://127.0.0.1:${port}/nand-pty`, 1024), (error: unknown) => {
				assert.ok(error instanceof BinaryError);
				assert.equal(error.code, 'http');
				assert.equal(error.detail?.status, 404);
				return true;
			});
		} finally {
			await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
		}
		await assert.rejects(downloadHelperBytes('http://127.0.0.1:1/nand-pty', 1024), (error: unknown) => error instanceof BinaryError && error.code === 'network');
	});
});
