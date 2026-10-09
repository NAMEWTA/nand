import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	pluginAssets, terminalAssets, verifyPluginAssets, verifyTerminalAssets, verifyVersions, writeChecksums,
} from '../../scripts/verify-release-artifacts.mjs';

const root = process.cwd();
const version = (JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8')) as { version: string }).version;
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

const dirs: string[] = [];
const scratch = () => {
	const dir = mkdtempSync(path.join(tmpdir(), 'nand-release-'));
	dirs.push(dir);
	return dir;
};
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

/**
 * A copy of the version files and plugin files as they are at a release commit. A leftover unreleased section of the
 * changelog is stripped from the copy, so the check also works while one is being drafted. Optionally with a
 * different changelog.
 */
function fakeRoot(changelog?: string) {
	const dir = scratch();
	for (const name of ['manifest.json', 'package.json', 'versions.json', ...pluginAssets]) copyFileSync(path.join(root, name), path.join(dir, name));
	const current = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').replace(/^## (未发布|Unreleased)\s*$[\s\S]*?(?=^## )/m, '');
	writeFileSync(path.join(dir, 'CHANGELOG.md'), changelog ?? current);
	return dir;
}

describe('release versions', () => {
	it('accepts the repository at its own version', () => {
		expect(verifyVersions(fakeRoot(), version).version).toBe(version);
	});

	it('rejects a tag that differs from the manifest or carries a prefix', () => {
		expect(() => verifyVersions(fakeRoot(), '9.9.9')).toThrow(/Manifest version/);
		expect(() => verifyVersions(fakeRoot(), `v${version}`)).toThrow(/unprefixed/);
	});

	it('requires a changelog section for the tag and no unreleased section', () => {
		expect(() => verifyVersions(fakeRoot('# Changes\n\n## 0.0.1\n'), version)).toThrow(/needs a "## /);
		expect(() => verifyVersions(fakeRoot(`# Changes\n\n## 未发布\n\n## ${version}\n`), version)).toThrow(/unreleased/);
	});
});

describe('release assets', () => {
	it('accepts the committed plugin files and rejects a different bundle', () => {
		const release = fakeRoot();
		const dir = scratch();
		for (const name of pluginAssets) copyFileSync(path.join(root, name), path.join(dir, name));
		expect(() => verifyPluginAssets(release, version, dir)).not.toThrow();
		writeFileSync(path.join(dir, 'main.js'), '/* MIT License */\nconsole.log(1);\n');
		expect(() => verifyPluginAssets(release, version, dir)).toThrow(/committed bundle/);
	});

	it('checks each helper binary against its checksum file', () => {
		const dir = scratch();
		for (const name of terminalAssets) {
			writeFileSync(path.join(dir, name), name);
			writeFileSync(path.join(dir, `${name}.sha256`), `${sha256(name)}  ${name}\n`);
		}
		expect(() => verifyTerminalAssets(dir)).not.toThrow();
		writeFileSync(path.join(dir, terminalAssets[0]!), 'tampered');
		expect(() => verifyTerminalAssets(dir)).toThrow(/checksum mismatch/);
	});

	it('writes sha256sum lines for every file, sorted, without listing itself', () => {
		const dir = scratch();
		writeFileSync(path.join(dir, 'b.txt'), 'b');
		writeFileSync(path.join(dir, 'a.txt'), 'a');
		mkdirSync(path.join(dir, 'nested'));
		expect(writeChecksums(dir)).toEqual(['a.txt', 'b.txt']);
		expect(writeChecksums(dir)).toEqual(['a.txt', 'b.txt']);
		expect(readFileSync(path.join(dir, 'SHA256SUMS.txt'), 'utf8')).toBe(`${sha256('a')}  a.txt\n${sha256('b')}  b.txt\n`);
	});
});
