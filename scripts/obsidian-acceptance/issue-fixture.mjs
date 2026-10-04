// Shared only by the open-issue acceptance scripts; never imported by production.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SHA256 = /^[a-f0-9]{64}$/i;
const COMMIT = /^[a-f0-9]{40}$/i;
export const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');

export function issueConfig(env = process.env) {
	assert.equal(env.NAND_ALLOW_BROWSER_E2E, '1', 'Explicit isolated acceptance opt-in required');
	assert.ok(env.NAND_WINDOWS_E2E_NONCE?.trim(), 'Exact isolated Vault nonce required');
	assert.match(env.NAND_EXPECT_MAIN_SHA ?? '', SHA256, 'NAND_EXPECT_MAIN_SHA must be a SHA256');
	for (const key of ['NAND_ACCEPTANCE_DIR', 'NAND_ACCEPTANCE_VAULT', 'NAND_ACCEPTANCE_PROFILE']) {
		assert.ok(path.isAbsolute(env[key] ?? ''), `${key} must be an absolute path`);
	}
	return {
		dir: env.NAND_ACCEPTANCE_DIR,
		vault: env.NAND_ACCEPTANCE_VAULT,
		profile: env.NAND_ACCEPTANCE_PROFILE,
		nonce: env.NAND_WINDOWS_E2E_NONCE,
		expectedMainSha256: env.NAND_EXPECT_MAIN_SHA.toLowerCase(),
	};
}

// This expression only reads identity and files. Do not create services before the gate.
export const ISSUE_RUNTIME = `(async()=>{
 const plugin=app.plugins.plugins.nand;
 if(!plugin)throw Error('NAND must already be enabled');
 const fs=window.require('fs'),path=window.require('path'),crypto=window.require('crypto'),process=window.require('process');
 const vault=fs.realpathSync(app.vault.adapter.basePath),profile=fs.realpathSync(window.require('@electron/remote').app.getPath('userData'));
 const pluginDir=fs.realpathSync(path.join(vault,app.vault.configDir,'plugins',plugin.manifest.id));
 const hash=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(pluginDir,name))).digest('hex');
 return {vault,profile,pluginDir,platform:process.platform,arch:process.arch,systemRoot:process.env.SystemRoot??null,
 marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json')),mainSha256:hash('main.js'),stylesSha256:hash('styles.css'),
 manifestSha256:hash('manifest.json'),version:plugin.manifest.version,originalLanguage:plugin.settings.language,
 obsidianVersion:navigator.userAgent.match(/obsidian\\/([\\d.]+)/i)?.[1]??app.version??null};
})()`;

export async function assertInside(root, candidate) {
	const realRoot = await fs.realpath(root);
	const resolved = path.resolve(candidate);
	const relative = path.relative(realRoot, resolved);
	assert.ok(relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative), 'Target must be inside the authorized directory');
	let current = realRoot;
	for (const part of relative.split(path.sep)) {
		current = path.join(current, part);
		try {
			assert.equal((await fs.lstat(current)).isSymbolicLink(), false, 'Symlink fixture targets are not allowed');
		} catch (error) {
			if (error.code !== 'ENOENT') throw error;
		}
	}
	return resolved;
}

export async function verifyIssueRuntime(config, runtime, cwd = process.cwd()) {
	assert.equal(runtime.marker?.kind, 'nand-windows-e2e', 'Use an existing explicitly isolated Vault marker');
	assert.equal(runtime.marker?.nonce, config.nonce, 'Wrong isolated Vault nonce');
	assert.equal(runtime.platform, process.platform, 'Acceptance runner and Obsidian must be on the same OS');
	for (const [actual, expected] of [[runtime.vault, config.vault], [runtime.profile, config.profile], [runtime.marker.vaultPath, config.vault]]) {
		assert.equal(await fs.realpath(actual), await fs.realpath(expected), 'Wrong Vault or profile');
	}
	await assertInside(runtime.vault, runtime.pluginDir);
	assert.ok(runtime.obsidianVersion, 'Actual Obsidian version is required');
	const main = hashBytes(await fs.readFile(path.join(cwd, 'main.js')));
	assert.equal(main, config.expectedMainSha256, 'Local main.js does not match the requested build');
	assert.equal(runtime.mainSha256, main, 'Deployed main.js does not match local main.js');
	for (const [name, key] of [['styles.css', 'stylesSha256'], ['manifest.json', 'manifestSha256']]) {
		assert.equal(runtime[key], hashBytes(await fs.readFile(path.join(cwd, name))), `Deployed ${name} differs`);
	}
	const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
	assert.match(sourceCommit, COMMIT);
	assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd, encoding: 'utf8' }).trim(), '', 'Commit tracked changes before native acceptance');
	return { ...runtime, sourceCommit, localMainSha256: main, deployedMainSha256: runtime.mainSha256 };
}

export async function acquireIssueLock(profile) {
	const file = path.join(profile, '.nand-open-issue-acceptance.lock');
	const owner = JSON.stringify({ pid: process.pid, nonce: randomUUID() });
	const handle = await fs.open(file, 'wx', 0o600); // Never steal another or a stale lock.
	try { await handle.writeFile(owner); } finally { await handle.close(); }
	return async () => {
		assert.equal((await fs.lstat(file)).isSymbolicLink(), false);
		assert.equal(await fs.readFile(file, 'utf8'), owner, 'Acceptance lock owner changed');
		await fs.unlink(file);
	};
}

// Two named binary/cache files only. No recursive profile/Vault backup or removal.
export async function snapshotFiles(root, files) {
	const result = [];
	for (const file of files) {
		await assertInside(root, file);
		try {
			const stat = await fs.stat(file);
			assert.ok(stat.isFile(), 'Fixture target must be a regular file');
			result.push({ file, bytes: await fs.readFile(file), mode: stat.mode, atime: stat.atime, mtime: stat.mtime });
		} catch (error) {
			if (error.code !== 'ENOENT') throw error;
			result.push({ file, bytes: null });
		}
	}
	return result;
}
export async function restoreFiles(root, snapshots) {
	for (const item of snapshots) {
		await assertInside(root, item.file);
		if (item.bytes === null) { await fs.rm(item.file, { force: true }); continue; }
		await fs.writeFile(item.file, item.bytes, { mode: item.mode });
		await fs.chmod(item.file, item.mode);
		await fs.utimes(item.file, item.atime, item.mtime);
	}
}

export function issueShell(runtime) {
	if (runtime.platform === 'win32') {
		assert.ok(path.win32.isAbsolute(runtime.systemRoot ?? ''), 'Windows SystemRoot is required');
		return { shellType: `custom:${path.win32.join(runtime.systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')}`, shellArgs: ['-NoLogo', '-NoProfile'] };
	}
	assert.ok(['linux', 'darwin'].includes(runtime.platform), 'Unsupported native acceptance platform');
	return { shellType: 'custom:/bin/bash', shellArgs: ['--noprofile', '--norc'] };
}
export function countBrowserEnvironmentCommand(platform) {
	// Split the marker so command echo cannot be mistaken for a result line.
	if (platform === 'win32') return `Write-Output ('NAND_' + 'ENV_COUNT=' + @(Get-ChildItem Env: | Where-Object { $_.Name -like 'NAND_BROWSER_*' }).Count)\r`;
	assert.ok(['linux', 'darwin'].includes(platform));
	return `printf '\\nNAND_%s=%s\\n' 'ENV_COUNT' "$(env | grep -ci '^NAND_BROWSER_')"\r`;
}
export function parseBrowserEnvironmentCount(output) {
	const text = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
	const match = text.match(/(?:^|\n)NAND_ENV_COUNT=(\d+)\r?(?:\n|$)/);
	return match ? Number(match[1]) : null;
}
export async function assertEndpointClosed(endpoint) {
	await new Promise((resolve, reject) => {
		const socket = net.createConnection(endpoint);
		const finish = error => { socket.destroy(); error ? reject(error) : resolve(); };
		socket.once('connect', () => finish(Error('Browser endpoint is still accepting connections')));
		socket.once('error', error => finish(['ENOENT', 'ECONNREFUSED'].includes(error.code) ? null : error));
		socket.setTimeout(1000, () => finish(Error('Endpoint state is uncertain')));
	});
}
