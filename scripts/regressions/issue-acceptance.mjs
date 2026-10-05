// Offline contracts for acceptance infrastructure, NOT native Obsidian evidence.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { execFileSync } from 'node:child_process';
import {
	issueConfig, hashBytes, ISSUE_RUNTIME, verifyIssueRuntime, assertInside, acquireIssueLock,
	snapshotFiles, restoreFiles, issueShell, countBrowserEnvironmentCommand,
	parseBrowserEnvironmentCount, assertEndpointClosed,
} from '../obsidian-acceptance/issue-fixture.mjs';

async function fixture(t) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nand-issue-fixture-'));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	const vault = path.join(root, 'vault'), profile = path.join(root, 'profile'), cwd = path.join(root, 'repo');
	const pluginDir = path.join(vault, '.obsidian', 'plugins', 'nand');
	for (const dir of [vault, profile, cwd, pluginDir]) await fs.mkdir(dir, { recursive: true });
	const files = { 'main.js': 'fixture main\n', 'styles.css': 'fixture style\n', 'manifest.json': '{"id":"nand","version":"0.0.1-alpha1"}\n' };
	for (const [name, text] of Object.entries(files)) await fs.writeFile(path.join(cwd, name), text);
	const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
	git(['init']); git(['add', '.']);
	git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture']);
	const env = {
		NAND_ALLOW_BROWSER_E2E: '1', NAND_WINDOWS_E2E_NONCE: 'fixture-only', NAND_EXPECT_MAIN_SHA: hashBytes(files['main.js']),
		NAND_ACCEPTANCE_DIR: path.join(root, 'evidence'), NAND_ACCEPTANCE_VAULT: vault, NAND_ACCEPTANCE_PROFILE: profile,
	};
	const runtime = { vault, profile, pluginDir, platform: process.platform, arch: process.arch, obsidianVersion: '1.13.7',
		marker: { kind: 'nand-windows-e2e', nonce: 'fixture-only', vaultPath: vault },
		mainSha256: hashBytes(files['main.js']), stylesSha256: hashBytes(files['styles.css']), manifestSha256: hashBytes(files['manifest.json']) };
	return { root, vault, profile, cwd, pluginDir, env, runtime, git, config: issueConfig(env) };
}

for (const field of ['NAND_ALLOW_BROWSER_E2E', 'NAND_WINDOWS_E2E_NONCE', 'NAND_EXPECT_MAIN_SHA', 'NAND_ACCEPTANCE_DIR', 'NAND_ACCEPTANCE_VAULT', 'NAND_ACCEPTANCE_PROFILE']) {
	test(`preflight rejects missing ${field} before creating output`, async t => {
		const f = await fixture(t), env = { ...f.env }; delete env[field];
		assert.throws(() => issueConfig(env));
		await assert.rejects(fs.stat(f.env.NAND_ACCEPTANCE_DIR), { code: 'ENOENT' });
	});
}
for (const value of ['1234', 'g'.repeat(64), ' '.repeat(64)]) {
	test(`preflight rejects malformed SHA256 ${JSON.stringify(value.slice(0, 4))}`, async t => {
		const f = await fixture(t); assert.throws(() => issueConfig({ ...f.env, NAND_EXPECT_MAIN_SHA: value }));
	});
}
for (const field of ['NAND_ACCEPTANCE_DIR', 'NAND_ACCEPTANCE_VAULT', 'NAND_ACCEPTANCE_PROFILE']) {
	test(`preflight rejects relative ${field}`, async t => {
		const f = await fixture(t); assert.throws(() => issueConfig({ ...f.env, [field]: 'relative/path' }));
	});
}
test('valid runtime gate returns the real source commit and equal hashes without writes', async t => {
	const f = await fixture(t);
	const result = await verifyIssueRuntime(f.config, f.runtime, f.cwd);
	assert.equal(result.sourceCommit, f.git(['rev-parse', 'HEAD']).trim());
	assert.equal(result.localMainSha256, result.deployedMainSha256);
	await assert.rejects(fs.stat(f.env.NAND_ACCEPTANCE_DIR), { code: 'ENOENT' });
});
for (const [label, change] of [
	['nonce', r => { r.marker.nonce = 'wrong'; }],
	['kind', r => { r.marker.kind = 'daily-vault'; }],
	['platform', r => { r.platform = 'other-os'; }],
	['deployed main', r => { r.mainSha256 = '0'.repeat(64); }],
	['styles', r => { r.stylesSha256 = '0'.repeat(64); }],
	['manifest', r => { r.manifestSha256 = '0'.repeat(64); }],
	['host version', r => { r.obsidianVersion = null; }],
]) {
	test(`runtime mismatch (${label}) rejects before a destructive action`, async t => {
		const f = await fixture(t), runtime = structuredClone(f.runtime); change(runtime);
		let mutated = false;
		await assert.rejects(async () => { await verifyIssueRuntime(f.config, runtime, f.cwd); mutated = true; });
		assert.equal(mutated, false);
	});
}
test('profile and marker Vault must exactly match the authorized paths', async t => {
	const f = await fixture(t), other = path.join(f.root, 'other'); await fs.mkdir(other);
	await assert.rejects(verifyIssueRuntime(f.config, { ...f.runtime, profile: other }, f.cwd));
	await assert.rejects(verifyIssueRuntime(f.config, { ...f.runtime, marker: { ...f.runtime.marker, vaultPath: other } }, f.cwd));
	await assert.rejects(verifyIssueRuntime(f.config, { ...f.runtime, pluginDir: other }, f.cwd));
});
test('local build mismatch and dirty tracked sources cannot be labeled verified', async t => {
	const f = await fixture(t);
	await assert.rejects(verifyIssueRuntime({ ...f.config, expectedMainSha256: '0'.repeat(64) }, f.runtime, f.cwd));
	await fs.writeFile(path.join(f.cwd, 'styles.css'), 'changed style');
	await assert.rejects(verifyIssueRuntime(f.config, { ...f.runtime, stylesSha256: hashBytes('changed style') }, f.cwd), /Commit tracked changes/);
});
test('runtime inspection expression is valid JavaScript and does not instantiate services', () => {
	assert.doesNotThrow(() => new Function(`return ${ISSUE_RUNTIME}`));
	assert.doesNotMatch(ISSUE_RUNTIME, /getTerminalService|ensureServer|writeFile|mkdir|createTerminal/);
});
test('two acceptance runs cannot share a profile; release allows the next run', async t => {
	const f = await fixture(t), release = await acquireIssueLock(f.profile);
	await assert.rejects(acquireIssueLock(f.profile), { code: 'EEXIST' });
	await release(); const next = await acquireIssueLock(f.profile); await next();
});
test('a changed lock owner is not removed', async t => {
	const f = await fixture(t), release = await acquireIssueLock(f.profile);
	const file = path.join(f.profile, '.nand-open-issue-acceptance.lock');
	await fs.writeFile(file, 'another owner');
	await assert.rejects(release, /owner changed/);
	assert.equal(await fs.readFile(file, 'utf8'), 'another owner');
});
test('targets cannot be the root, siblings, or outside the authorized tree', async t => {
	const f = await fixture(t);
	for (const target of [f.pluginDir, `${f.pluginDir}-other/file`, path.join(f.pluginDir, '..', 'other', 'file')]) await assert.rejects(assertInside(f.pluginDir, target));
	assert.equal(await assertInside(f.pluginDir, path.join(f.pluginDir, 'binaries', 'server')), path.join(f.pluginDir, 'binaries', 'server'));
});
test('an explicitly authorized aliased root does not mix canonical and lexical path spellings', async t => {
	const f = await fixture(t), alias = path.join(f.root, 'authorized-root-alias');
	await fs.symlink(f.pluginDir, alias, 'junction');
	const target = path.join(alias, 'new-binary');
	assert.notEqual(await fs.realpath(alias), alias);
	assert.equal(await assertInside(alias, target), target);
	const snapshots = await snapshotFiles(alias, [target]);
	await fs.writeFile(target, 'temporary');
	await restoreFiles(alias, snapshots);
	await assert.rejects(fs.stat(target), { code: 'ENOENT' });
	await assert.rejects(assertInside(alias, path.join(alias, '..', 'outside')));
});
test('symlink/junction parents cannot redirect binary snapshots or restoration', async t => {
	const f = await fixture(t), outside = path.join(f.root, 'outside'); await fs.mkdir(outside);
	await fs.symlink(outside, path.join(f.pluginDir, 'binaries'), 'junction');
	await assert.rejects(snapshotFiles(f.pluginDir, [path.join(f.pluginDir, 'binaries', 'server')]), /Symlink/);
});
test('binary/cache restoration preserves original bytes, mtime and absent files', async t => {
	const f = await fixture(t), binary = path.join(f.pluginDir, 'server'), cache = path.join(f.pluginDir, 'version.json'), absent = path.join(f.pluginDir, 'absent');
	await fs.writeFile(binary, 'original executable', { mode: 0o755 });
	await fs.writeFile(cache, '{"original":true}');
	const before = await fs.stat(binary), snapshots = await snapshotFiles(f.pluginDir, [binary, cache, absent]);
	await fs.writeFile(binary, 'replacement'); await fs.rm(cache); await fs.writeFile(absent, 'temporary');
	await restoreFiles(f.pluginDir, snapshots);
	assert.equal(await fs.readFile(binary, 'utf8'), 'original executable');
	assert.equal(await fs.readFile(cache, 'utf8'), '{"original":true}');
	assert.ok(Math.abs((await fs.stat(binary)).mtimeMs - before.mtimeMs) < 1);
	if (process.platform !== 'win32') assert.equal((await fs.stat(binary)).mode & 0o777, 0o755);
	await assert.rejects(fs.stat(absent), { code: 'ENOENT' });
});
test('directories are not accepted as binary files', async t => {
	const f = await fixture(t); const target = path.join(f.pluginDir, 'directory'); await fs.mkdir(target);
	await assert.rejects(snapshotFiles(f.pluginDir, [target]), /regular file/);
});
test('Windows acceptance uses PowerShell and no profile; Linux/macOS use explicit clean bash', () => {
	assert.deepEqual(issueShell({ platform: 'win32', systemRoot: 'C:\\Windows' }), { shellType: 'custom:C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', shellArgs: ['-NoLogo', '-NoProfile'] });
	for (const platform of ['linux', 'darwin']) assert.deepEqual(issueShell({ platform }), { shellType: 'custom:/bin/bash', shellArgs: ['--noprofile', '--norc'] });
	assert.throws(() => issueShell({ platform: 'win32', systemRoot: 'relative' }));
	assert.throws(() => issueShell({ platform: 'android' }));
});
for (const platform of ['linux', 'darwin', 'win32']) {
	test(`${platform} command echo is not accepted as an environment count`, () => {
		assert.equal(parseBrowserEnvironmentCount(countBrowserEnvironmentCommand(platform)), null);
	});
}
test('count parsing requires a standalone result line and handles CRLF/ANSI', () => {
	assert.equal(parseBrowserEnvironmentCount('prefix NAND_ENV_COUNT=4'), null);
	assert.equal(parseBrowserEnvironmentCount('\nNAND_ENV_COUNT=4 rubbish'), null);
	assert.equal(parseBrowserEnvironmentCount('\nNAND_ENV_COUNT=0\r\n'), 0);
	assert.equal(parseBrowserEnvironmentCount('\x1b[32mNAND_ENV_COUNT=4\x1b[0m\r\n'), 4);
});
test('actual local shell emits only a count, including mixed-case reserved names', () => {
	const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('NAND_BROWSER_')));
	environment.NAND_BROWSER_TOKEN = 'fixture-value-not-to-print'; environment.nand_browser_cli = 'fixture-client';
	const command = countBrowserEnvironmentCommand(process.platform).trimEnd();
	const shell = issueShell({ platform: process.platform, systemRoot: process.env.SystemRoot });
	const args = [...shell.shellArgs, process.platform === 'win32' ? '-Command' : '-c', command];
	// Cold powershell.exe on a loaded GitHub-hosted Windows runner can exceed 8s. The parent runner allows 60s for this file.
	const output = execFileSync(shell.shellType.slice('custom:'.length), args, { env: environment, encoding: 'utf8', timeout: 20000 });
	assert.equal(parseBrowserEnvironmentCount(output), 2); assert.doesNotMatch(output, /fixture-value-not-to-print/);
});
test('endpoint check rejects an accepting socket/pipe and accepts a closed one', async t => {
	const f = await fixture(t);
	const endpoint = process.platform === 'win32' ? `\\\\.\\pipe\\nand-issue-test-${process.pid}-${Date.now()}` : path.join(f.root, 'test.sock');
	const server = net.createServer(socket => socket.end());
	await new Promise((resolve, reject) => { server.once('error', reject); server.listen(endpoint, resolve); });
	try { await assert.rejects(assertEndpointClosed(endpoint), /still accepting/); }
	finally { await new Promise(resolve => server.close(resolve)); }
	await assertEndpointClosed(endpoint);
});

for (const name of ['issue-fixture', 'terminal-repair', 'issue-seed', 'issue-startup']) {
	test(`${name} parses without executing any native acceptance action`, () => {
		execFileSync(process.execPath, ['--check', `scripts/obsidian-acceptance/${name}.mjs`], { stdio: 'pipe' });
	});
}
