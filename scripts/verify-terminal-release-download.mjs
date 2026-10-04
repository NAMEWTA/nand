// Explicit online release smoke test. Only a fresh owned temporary plugin directory is modified.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { BinaryDownloader } from '../src/platform/terminal-server/binary-downloader.ts';
assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
const root = mkdtempSync(path.join(tmpdir(), 'nand-published-download-'));
const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
Object.defineProperty(globalThis, 'window', { configurable: true, value: { require: createRequire(import.meta.url) } });
try {
 const { version } = JSON.parse(readFileSync('manifest.json', 'utf8'));
 const downloader = new BinaryDownloader(root, version, { source: 'github-release' });
 assert.equal(downloader.binaryExists(), false);
 await downloader.download();
 assert.equal(downloader.binaryExists(), true);
 assert.equal(downloader.needsUpdate(), false);
 const binary = downloader.getBinaryPath();
 const sha256 = createHash('sha256').update(readFileSync(binary)).digest('hex');
 const result = spawnSync(process.execPath, ['scripts/verify-pty-automation.mjs', binary], { stdio: 'inherit', timeout: 90000 });
 if (result.error) throw result.error;
 assert.equal(result.status, 0, 'Downloaded protocol-2 service must pass authenticated integration');
 console.log(JSON.stringify({ passed: true, version, sha256, platform: process.platform, arch: process.arch }));
} finally {
 if (previous) Object.defineProperty(globalThis, 'window', previous);
 else Reflect.deleteProperty(globalThis, 'window');
 rmSync(root, { recursive: true, force: true });
}
