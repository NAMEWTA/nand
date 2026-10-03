import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBinaryAssetUrls } from './binary-download-urls.ts';
import { BinaryDownloader } from './binary-downloader.ts';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, statSync, rmSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { terminalAssets, verifyReleaseArtifacts } from '../../../scripts/verify-release-artifacts.mjs';

test('release candidate versions agree and advance beyond the incompatible public service', () => {
	const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
	assert.notEqual(manifest.version, '0.0.1');
	verifyReleaseArtifacts(process.cwd(), manifest.version);
	for (const [platform, arch] of [['linux', 'x64'], ['linux', 'arm64'], ['darwin', 'x64'], ['darwin', 'arm64'], ['win32', 'x64']] as const) {
		const urls = resolveBinaryAssetUrls({ version: manifest.version, platform, arch, source: 'github-release' });
		assert.ok(terminalAssets.includes(urls.filename));
		assert.ok(urls.url.includes(`/download/${manifest.version}/`));
		assert.equal(urls.checksumUrl, `${urls.url}.sha256`);
	}
});

test('upgrading the plugin rejects an installed 0.0.1 service and accepts the matching service', () => {
	const root = mkdtempSync(path.join(tmpdir(), 'nand-binary-version-'));
	const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
	Object.defineProperty(globalThis, 'window', { value: { require: createRequire(import.meta.url) }, configurable: true });
	try {
		const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
		const create = () => new BinaryDownloader(root, manifest.version, { source: 'github-release' });
		const downloader = create();
		assert.equal(downloader.binaryExists(), false);
		mkdirSync(path.dirname(downloader.getBinaryPath()), { recursive: true });
		writeFileSync(downloader.getBinaryPath(), 'synthetic binary');
		const { size, mtimeMs } = statSync(downloader.getBinaryPath());
		const cache = path.join(root, 'binaries', '.rust-terminal-servers.version.json');
		writeFileSync(cache, JSON.stringify({ version: '0.0.1', size, mtimeMs }));
		assert.equal(downloader.binaryExists(), false);
		assert.equal(downloader.needsUpdate(), true);
		writeFileSync(cache, JSON.stringify({ version: manifest.version, size, mtimeMs }));
		assert.equal(create().binaryExists(), true);
		assert.equal(create().needsUpdate(), false);
		writeFileSync(downloader.getBinaryPath(), 'changed binary invalidates cached metadata');
		assert.equal(create().binaryExists(), false);
	} finally {
		if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
		else Reflect.deleteProperty(globalThis, 'window');
		rmSync(root, { recursive: true, force: true });
	}
});

test('release gate rejects wrong tags, missing platforms and corrupt terminal assets', () => {
	const root = mkdtempSync(path.join(tmpdir(), 'nand-release-gate-'));
	const artifacts = path.join(root, 'assets');
	mkdirSync(artifacts);
	try {
		writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ version: '0.0.2', minAppVersion: '1.12.0' }));
		writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.0.2' }));
		writeFileSync(path.join(root, 'versions.json'), JSON.stringify({ '0.0.2': '1.12.0' }));
		assert.throws(() => verifyReleaseArtifacts(root, '0.0.3'), /Manifest version/);
		assert.throws(() => verifyReleaseArtifacts(root, 'v0.0.2'), /unprefixed/);
		writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ version: '0.0.1-alpha1', minAppVersion: '1.12.0' }));
		writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.0.1-alpha1' }));
		writeFileSync(path.join(root, 'versions.json'), JSON.stringify({ '0.0.1-alpha1': '1.12.0' }));
		verifyReleaseArtifacts(root, '0.0.1-alpha1');
		assert.throws(() => verifyReleaseArtifacts(root, '0.0.1'), /Manifest version/);
		writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ version: '0.0.2', minAppVersion: '1.12.0' }));
		writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '0.0.2' }));
		writeFileSync(path.join(root, 'versions.json'), JSON.stringify({ '0.0.2': '1.12.0' }));
		for (const name of terminalAssets) {
			const bytes = Buffer.from(`synthetic ${name}`);
			writeFileSync(path.join(artifacts, name), bytes);
			writeFileSync(path.join(artifacts, `${name}.sha256`), `${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`);
		}
		verifyReleaseArtifacts(root, '0.0.2', artifacts);
		const name = terminalAssets[0]!;
		writeFileSync(path.join(artifacts, name), 'corrupted');
		assert.throws(() => verifyReleaseArtifacts(root, '0.0.2', artifacts), /checksum mismatch/);
		unlinkSync(path.join(artifacts, name));
		assert.throws(() => verifyReleaseArtifacts(root, '0.0.2', artifacts), /exactly five/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('resolveBinaryAssetUrls builds GitHub Release URLs for Unix binaries', () => {
	const urls = resolveBinaryAssetUrls({
		version: '0.0.2',
		platform: 'linux',
		arch: 'x64',
		source: 'github-release',
	});

	assert.equal(urls.url, 'https://github.com/NAMEWTA/nand/releases/download/0.0.2/rust-terminal-servers-linux-x64');
	assert.equal(
		urls.checksumUrl,
		'https://github.com/NAMEWTA/nand/releases/download/0.0.2/rust-terminal-servers-linux-x64.sha256',
	);
});

test('resolveBinaryAssetUrls ignores the legacy R2 source and still uses GitHub', () => {
	const urls = resolveBinaryAssetUrls({
		version: '0.0.2',
		platform: 'win32',
		arch: 'x64',
		source: 'cloudflare-r2',
	});

	assert.equal(
		urls.url,
		'https://github.com/NAMEWTA/nand/releases/download/0.0.2/rust-terminal-servers-win32-x64.exe',
	);
});

test('resolveBinaryAssetUrls builds GitHub latest fallback URLs', () => {
	const urls = resolveBinaryAssetUrls({
		version: '0.0.2',
		platform: 'darwin',
		arch: 'arm64',
		source: 'github-release',
		releaseChannel: 'latest',
	});

	assert.equal(
		urls.url,
		'https://github.com/NAMEWTA/nand/releases/latest/download/rust-terminal-servers-darwin-arm64',
	);
});
