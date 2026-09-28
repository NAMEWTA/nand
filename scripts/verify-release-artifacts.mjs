import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const terminalAssets = [
	'linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64', 'win32-x64.exe',
].map((target) => `rust-terminal-servers-${target}`);

export function verifyReleaseArtifacts(root, tag, artifacts) {
	const readJson = (name) => JSON.parse(readFileSync(path.join(root, name), 'utf8'));
	const manifest = readJson('manifest.json');
	assert.match(tag, /^\d+\.\d+\.\d+$/, 'Release requires an unprefixed version tag');
	assert.equal(manifest.version, tag, 'Manifest version must equal the release tag');
	assert.equal(readJson('package.json').version, tag, 'Package version must equal the release tag');
	assert.equal(readJson('versions.json')[tag], manifest.minAppVersion, 'Version compatibility entry must match');
	if (!artifacts) return;
	const expected = terminalAssets.flatMap((name) => [name, `${name}.sha256`]).sort();
	assert.deepEqual(readdirSync(artifacts).sort(), expected, 'Release requires exactly five binaries and their checksums');
	for (const name of terminalAssets) {
		const bytes = readFileSync(path.join(artifacts, name));
		assert.ok(bytes.length, `${name} must not be empty`);
		const digest = createHash('sha256').update(bytes).digest('hex');
		assert.equal(readFileSync(path.join(artifacts, `${name}.sha256`), 'utf8').trim(),
			`${digest}  ${name}`, `${name} checksum mismatch`);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	verifyReleaseArtifacts(process.cwd(), process.argv[2], process.argv[3]);
	console.log('Release versions and supplied assets verified');
}
