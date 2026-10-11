import assert from 'node:assert/strict';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'vitest';
import { assetName, BinaryError, ensureHelper, parseDigest, RELEASE_BASE } from './binary';

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

function hostReceipt() {
	const key = randomBytes(32);
	return {
		seal(value: string) {
			const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
			const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
			return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
		},
		open(value: string) {
			const bytes = Buffer.from(value, 'base64'), decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
			decipher.setAuthTag(bytes.subarray(12, 28));
			return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
		},
	};
}

function setup() {
	const receipt = hostReceipt();
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
	return { receipt, pluginDir, binary, requests, fetch, setDigest: (value: string) => { digest = value; }, file: path.join(pluginDir, '.nand/helpers/fixture-device/linux-x64/0.0.1-alpha.1', 'nand-pty-linux-x64') };
}

test('a replaced binary and matching self-written receipt never grant execution trust, online or offline', async () => {
	const f = setup();
	const options = { vault: f.pluginDir, receipt: f.receipt, device: 'fixture-device', version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: f.fetch };
	try {
		await ensureHelper(options);
		const stamp = path.join(path.dirname(f.file), 'nand-pty.json'), proof = fs.readFileSync(stamp);
		fs.writeFileSync(f.file, 'forged');
		fs.writeFileSync(stamp, JSON.stringify({ version: options.version, sha256: sha(Buffer.from('forged')), source: 'release' }));
		f.requests.length = 0;
		await assert.rejects(ensureHelper({ ...options, offline: true }), (error) => error instanceof BinaryError && error.code === 'offlineMissing');
		assert.deepEqual(f.requests, []);
		await ensureHelper(options);
		assert.equal(f.requests.length, 2);
		assert.deepEqual(fs.readFileSync(f.file), f.binary);
		fs.writeFileSync(stamp, proof);
		await assert.rejects(ensureHelper({ ...options, receipt: hostReceipt(), offline: true }), (error) => error instanceof BinaryError && error.code === 'offlineMissing');
		f.requests.length = 0;
		await ensureHelper({ ...options, receipt: hostReceipt() });
		assert.equal(f.requests.length, 1, 'another host must obtain the official digest again');
		await assert.rejects(ensureHelper({ ...options, receipt: undefined, offline: true }), (error) => error instanceof BinaryError && error.code === 'offlineMissing');
	} finally { fs.rmSync(f.pluginDir, { recursive: true, force: true }); }
});

test('asset names and digest parsing', () => {
	assert.equal(assetName('linux', 'x64'), 'nand-pty-linux-x64');
	assert.equal(assetName('darwin', 'arm64'), 'nand-pty-darwin-arm64');
	assert.equal(assetName('win32', 'x64'), 'nand-pty-win32-x64.exe');
	assert.equal(assetName('win32', 'arm64'), null);
	assert.equal(assetName('freebsd', 'x64'), null);
	assert.equal(parseDigest(`${'A'.repeat(64)}  file`), 'a'.repeat(64));
	assert.equal(parseDigest('not-a-digest'), null);
});

test('retained legacy helpers require official verification once, then work offline without another binary download', async () => {
	const f = setup(), legacy = path.join(f.pluginDir, '.nand/helpers/fixture-device/legacy-plugin/files');
	const options = { vault: f.pluginDir, receipt: f.receipt, device: 'fixture-device', version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: f.fetch };
	try {
		fs.mkdirSync(legacy, { recursive: true }); fs.writeFileSync(path.join(legacy, 'nand-pty-linux-x64'), f.binary);
		await assert.rejects(ensureHelper({ ...options, offline: true }), (error) => error instanceof BinaryError && error.code === 'offlineMissing');
		await ensureHelper(options);
		assert.equal(f.requests.length, 1, 'fetch only the official digest for the retained candidate');
		assert.deepEqual(fs.readFileSync(f.file), f.binary);
		f.requests.length = 0; await ensureHelper({ ...options, offline: true }); assert.deepEqual(f.requests, []);
	} finally { fs.rmSync(f.pluginDir, { recursive: true, force: true }); }
});

test('upgrades install inside the vault with a distinct version path and retain the old running binary', async () => {
	const f = setup();
	try {
		const options = { vault: f.pluginDir, receipt: f.receipt, device: 'fixture-device', offline: false, platform: 'linux', arch: 'x64', fetch: f.fetch };
		const first = await ensureHelper({ ...options, version: '0.0.1-alpha.1' });
		const second = await ensureHelper({ ...options, version: '0.0.1-alpha.2' });
		assert.notEqual(first, second);
		assert.equal(path.relative(f.pluginDir, second), path.join('.nand', 'helpers', 'fixture-device', 'linux-x64', '0.0.1-alpha.2', 'nand-pty-linux-x64'));
		assert.deepEqual(fs.readFileSync(first), f.binary);
		assert.deepEqual(fs.readFileSync(second), f.binary);
	} finally { fs.rmSync(f.pluginDir, { recursive: true, force: true }); }
});

test('downloads from the matching release, verifies, then reuses the verified file offline of the network', async () => {
	const f = setup();
	const installed = await ensureHelper({ vault: f.pluginDir, receipt: f.receipt, device: 'fixture-device', version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: f.fetch });
	assert.equal(installed, f.file);
	assert.deepEqual(fs.readFileSync(f.file), f.binary);
	assert.deepEqual(f.requests, [`${RELEASE_BASE}/0.0.1-alpha.1/nand-pty-linux-x64.sha256`, `${RELEASE_BASE}/0.0.1-alpha.1/nand-pty-linux-x64`]);
	f.requests.length = 0;
	await ensureHelper({ vault: f.pluginDir, receipt: f.receipt, device: 'fixture-device', version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: f.fetch });
	assert.deepEqual(f.requests, [], 'a verified file for this version needs no network');
});

test('a hand-placed file is accepted only when it matches the published digest', async () => {
	const f = setup();
	fs.mkdirSync(path.dirname(f.file), { recursive: true });
	fs.writeFileSync(f.file, f.binary);
	await ensureHelper({ vault: f.pluginDir, receipt: f.receipt, device: 'fixture-device', version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: f.fetch });
	assert.equal(f.requests.length, 1, 'only the digest was requested');
	const g = setup();
	fs.mkdirSync(path.dirname(g.file), { recursive: true });
	fs.writeFileSync(g.file, 'unknown');
	await ensureHelper({ vault: g.pluginDir, receipt: g.receipt, device: 'fixture-device', version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: g.fetch });
	assert.deepEqual(fs.readFileSync(g.file), g.binary, 'an unknown file is replaced by the verified download');
});

test('missing or mismatched checksums stop installation and keep the previous file', async () => {
	const f = setup();
	f.setDigest('garbage');
	await assert.rejects(ensureHelper({ vault: f.pluginDir, receipt: f.receipt, device: 'fixture-device', version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: f.fetch }), (error: unknown) => error instanceof BinaryError && error.code === 'checksumMissing');
	f.setDigest(`${'0'.repeat(64)}  nand-pty-linux-x64`);
	fs.mkdirSync(path.dirname(f.file), { recursive: true });
	fs.writeFileSync(f.file, 'previous');
	await assert.rejects(ensureHelper({ vault: f.pluginDir, receipt: f.receipt, device: 'fixture-device', version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64', fetch: f.fetch }), (error: unknown) => error instanceof BinaryError && error.code === 'checksumMismatch');
	assert.equal(fs.readFileSync(f.file, 'utf8'), 'previous');
	assert.equal(fs.existsSync(`${f.file}.download`), false);
});

test('offline mode never downloads and requires an installed file', async () => {
	const f = setup();
	await assert.rejects(ensureHelper({ vault: f.pluginDir, receipt: f.receipt, device: 'fixture-device', version: '0.0.1-alpha.1', offline: true, platform: 'linux', arch: 'x64', fetch: f.fetch }), (error: unknown) => error instanceof BinaryError && error.code === 'offlineMissing');
	fs.mkdirSync(path.dirname(f.file), { recursive: true });
	fs.writeFileSync(f.file, 'any');
	await assert.rejects(ensureHelper({ vault: f.pluginDir, receipt: f.receipt, device: 'fixture-device', version: '0.0.1-alpha.1', offline: true, platform: 'linux', arch: 'x64', fetch: f.fetch }), (error) => error instanceof BinaryError && error.code === 'offlineMissing');
	assert.deepEqual(f.requests, []);
	await assert.rejects(ensureHelper({ vault: f.pluginDir, receipt: f.receipt, device: 'fixture-device', version: '0.0.1-alpha.1', offline: false, platform: 'win32', arch: 'arm64', fetch: f.fetch }), (error: unknown) => error instanceof BinaryError && error.code === 'unsupported');
});

test('installation failures identify the requested release and keep the previous binary until a retry succeeds', async () => {
	const f = setup();
	fs.mkdirSync(path.dirname(f.file), { recursive: true });
	fs.writeFileSync(f.file, 'previous');
	const options = { vault: f.pluginDir, receipt: f.receipt, device: 'fixture-device', version: '0.0.1-alpha.1', offline: false, platform: 'linux', arch: 'x64' };
	await assert.rejects(ensureHelper({ ...options, fetch: async () => { throw new BinaryError('http', 'HTTP 404', { status: 404 }); } }), (error: unknown) => {
		assert.ok(error instanceof BinaryError);
		assert.deepEqual(error.detail, { status: 404, version: options.version, url: `${RELEASE_BASE}/${options.version}/nand-pty-linux-x64.sha256` });
		assert.equal(fs.readFileSync(f.file, 'utf8'), 'previous');
		return true;
	});
	await ensureHelper({ ...options, fetch: f.fetch });
	assert.deepEqual(fs.readFileSync(f.file), f.binary);
});
