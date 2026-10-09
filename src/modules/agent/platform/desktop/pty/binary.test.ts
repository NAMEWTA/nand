import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'vitest';
import { assetName, BinaryError, ensureHelper, parseDigest, RELEASE_BASE } from './binary';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

function setup() {
	const pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nand-helper-'));
	const binary = Buffer.from('helper-binary-v1');
	const requests: string[] = [];
	let digest = `${sha(binary)}  nand-pty-linux-x64\n`;
	const fetch = async (url: string, limit: number) => {
		requests.push(url);
		if (url.endsWith('.sha256')) {
			const body = Buffer.from(digest);
			if (body.length > limit) throw new BinaryError('tooLarge', 'too large');
			return body;
		}
		return binary;
	};
	return { pluginDir, binary, requests, fetch, setDigest: (value: string) => { digest = value; }, file: path.join(pluginDir, 'binaries', 'nand-pty-linux-x64') };
}

test('asset names and digest parsing', () => {
	assert.equal(assetName('linux', 'x64'), 'nand-pty-linux-x64');
	assert.equal(assetName('darwin', 'arm64'), 'nand-pty-darwin-arm64');
	assert.equal(assetName('win32', 'x64'), 'nand-pty-win32-x64.exe');
	assert.equal(assetName('win32', 'arm64'), null);
	assert.equal(assetName('freebsd', 'x64'), null);
	assert.equal(parseDigest(`${'A'.repeat(64)}  file`), 'a'.repeat(64));
	assert.equal(parseDigest('not-a-digest'), null);
});

test('downloads from the matching release, verifies, then reuses the verified file offline of the network', async () => {
	const f = setup();
	const installed = await ensureHelper({ pluginDir: f.pluginDir, version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: f.fetch });
	assert.equal(installed, f.file);
	assert.deepEqual(fs.readFileSync(f.file), f.binary);
	assert.deepEqual(f.requests, [`${RELEASE_BASE}/0.0.1-alpha.1/nand-pty-linux-x64.sha256`, `${RELEASE_BASE}/0.0.1-alpha.1/nand-pty-linux-x64`]);
	f.requests.length = 0;
	await ensureHelper({ pluginDir: f.pluginDir, version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: f.fetch });
	assert.deepEqual(f.requests, [], 'a verified file for this version needs no network');
});

test('a hand-placed file is accepted only when it matches the published digest', async () => {
	const f = setup();
	fs.mkdirSync(path.dirname(f.file), { recursive: true });
	fs.writeFileSync(f.file, f.binary);
	await ensureHelper({ pluginDir: f.pluginDir, version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: f.fetch });
	assert.equal(f.requests.length, 1, 'only the digest was requested');
	const g = setup();
	fs.mkdirSync(path.dirname(g.file), { recursive: true });
	fs.writeFileSync(g.file, 'unknown');
	await ensureHelper({ pluginDir: g.pluginDir, version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: g.fetch });
	assert.deepEqual(fs.readFileSync(g.file), g.binary, 'an unknown file is replaced by the verified download');
});

test('missing or mismatched checksums stop installation and keep the previous file', async () => {
	const f = setup();
	f.setDigest('garbage');
	await assert.rejects(ensureHelper({ pluginDir: f.pluginDir, version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: f.fetch }), (error: unknown) => error instanceof BinaryError && error.code === 'checksumMissing');
	f.setDigest(`${'0'.repeat(64)}  nand-pty-linux-x64`);
	fs.mkdirSync(path.dirname(f.file), { recursive: true });
	fs.writeFileSync(f.file, 'previous');
	await assert.rejects(ensureHelper({ pluginDir: f.pluginDir, version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: f.fetch }), (error: unknown) => error instanceof BinaryError && error.code === 'checksumMismatch');
	assert.equal(fs.readFileSync(f.file, 'utf8'), 'previous');
	assert.equal(fs.existsSync(`${f.file}.download`), false);
});

test('offline mode never downloads and requires an installed file', async () => {
	const f = setup();
	await assert.rejects(ensureHelper({ pluginDir: f.pluginDir, version: '0.0.1-alpha.1', offline: true, platform: 'linux', arch: 'x64', fetch: f.fetch }), (error: unknown) => error instanceof BinaryError && error.code === 'offlineMissing');
	fs.mkdirSync(path.dirname(f.file), { recursive: true });
	fs.writeFileSync(f.file, 'any');
	assert.equal(await ensureHelper({ pluginDir: f.pluginDir, version: '0.0.1-alpha.1', offline: true, platform: 'linux', arch: 'x64', fetch: f.fetch }), f.file);
	assert.deepEqual(f.requests, []);
	await assert.rejects(ensureHelper({ pluginDir: f.pluginDir, version: '0.0.1-alpha.1', offline: false, platform: 'win32', arch: 'arm64', fetch: f.fetch }), (error: unknown) => error instanceof BinaryError && error.code === 'unsupported');
});
