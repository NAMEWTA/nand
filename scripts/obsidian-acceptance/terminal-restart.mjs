// Fixed-task Windows restart acceptance. Never run against a daily profile.
// Requires the same opt-in/nonce/evidence env as terminal-fixture.mjs, CDP 9237,
// and an already running Obsidian using scripts/tmp/e2e-2026-09-30/profile.
// HOME/USERPROFILE/APPDATA/LOCALAPPDATA must already be inside that task root.
// After this script's tool call returns, use a NEW independent tool call with
// the same evidence env and --verify-after-return. Only that makes passed=true.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { connect } from './cdp.mjs';
import { authorize, seedHistory, until, delay } from './terminal-fixture.mjs';

const runFile = promisify(execFile);
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const taskRoot = path.join(repository, 'scripts/tmp/e2e-2026-09-30');
const expectedProfile = path.join(taskRoot, 'profile');
const expectedVault = path.join(taskRoot, 'vault');
const environmentKeys = ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'];
const equalPath = (a, b) => path.win32.resolve(a).toLowerCase() === path.win32.resolve(b).toLowerCase();
const inside = (root, value) => { const relative = path.win32.relative(root, value); return relative === '' || (!relative.startsWith('..') && !path.win32.isAbsolute(relative)); };
const checks = [];
let c, authorized, initial, restarted, originalState, originalEnv, metadataPath, metadataBefore, metadataWritten, layoutPath;
let ownedLeafId, createdLeaf = false, fixtureChanged = false, quitStarted = false;
let launch;

async function bounded(operation, label, ms = 12000) {
  let timer;
  try { return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`Timed out: ${label}`)), ms); })]); }
  finally { clearTimeout(timer); }
}
async function queryProcess(pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  const script = `Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}' | Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine,@{Name='CreationTimeUtc';Expression={$_.CreationDate.ToUniversalTime().ToString('o')}} | ConvertTo-Json -Compress`;
  const { stdout } = await runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, encoding: 'utf8' });
  return stdout.trim() ? JSON.parse(stdout.trim()) : null;
}
function assertIdentity(identity, runtime) {
  assert.ok(identity && identity.ProcessId === runtime.pid, 'The live main process must match Electron');
  assert.ok(identity.CreationTimeUtc, 'A live process creation time is required');
  assert.ok(equalPath(identity.ExecutablePath, runtime.exe), 'CIM executable must match Electron');
  assert.equal(path.win32.basename(identity.ExecutablePath).toLowerCase(), 'obsidian.exe');
  assert.ok(!/\s--type(?:=|\s)/i.test(identity.CommandLine), 'A renderer/helper is not the main app');
  const profile = identity.CommandLine.match(/(?:^|\s)"?--user-data-dir(?:=|\s+)(?:"([^"]+)"|([^\s"]+))/i);
  assert.ok(profile && equalPath(profile[1] || profile[2], expectedProfile), 'Only the exact fixed isolated profile is eligible');
  assert.ok(/--remote-debugging-port(?:=|\s+)9237(?:\s|"|$)/i.test(identity.CommandLine), 'The owned app must use CDP 9237');
}
async function runtimeIdentity() {
  return bounded(c.evaluate(`(()=>{const electron=window.require('electron'),remote=electron.remote||window.require('@electron/remote'),main=remote.process||remote.getGlobal('process'),process=window.require('process'),safe={};for(const key of ${JSON.stringify(environmentKeys)})safe[key]=process.env[key]||null;return {pid:Number(main.pid),exe:remote.app.getPath('exe'),profile:remote.app.getPath('userData'),safe,platform:process.platform,vault:app.vault.adapter.basePath}})()`), 'runtime main-process identity');
}
async function deploymentHashes() {
  return bounded(c.evaluate(`(()=>{const fs=window.require('fs'),path=window.require('path'),crypto=window.require('crypto'),plugin=path.join(app.vault.adapter.basePath,app.vault.configDir,'plugins/nand'),hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(plugin,file))).digest('hex');return {mainSha256:hash('main.js'),stylesSha256:hash('styles.css'),nativeSha256:hash('binaries/rust-terminal-servers-win32-x64.exe')}})()`), 'deployed production hashes');
}
function expectedHashes(runtime) {
  return Object.fromEntries(['mainSha256', 'stylesSha256', 'nativeSha256'].map(key => [key, runtime[key]]));
}
async function launchIsolatedApp() {
  // Start-Process keeps the Windows app independent of the short-lived Node
  // harness. Environment changes exist only in this PowerShell helper process.
  const config = { exe: initial.exe, profile: expectedProfile, env: { ...initial.safe, ...authorized.homes } };
  const encoded = Buffer.from(JSON.stringify(config), 'utf8').toString('base64');
  const script = `$ErrorActionPreference='Stop';$config=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))|ConvertFrom-Json;foreach($entry in $config.env.PSObject.Properties){[Environment]::SetEnvironmentVariable($entry.Name,[string]$entry.Value,'Process')};$arguments=@(('"--user-data-dir='+$config.profile+'"'),'--remote-debugging-address=127.0.0.1','--remote-debugging-port=9237');$owned=Start-Process -FilePath $config.exe -ArgumentList $arguments -WindowStyle Hidden -PassThru -ErrorAction Stop;$owned.Id`;
  const { stdout } = await runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, encoding: 'utf8', timeout: 15000 });
  const pid = Number(stdout.trim()); assert.ok(Number.isSafeInteger(pid) && pid > 0, 'Start-Process must return the owned main PID');
  launch = { method: 'Start-Process -WindowStyle Hidden', pid, exe: config.exe, args: [`--user-data-dir=${expectedProfile}`, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9237'], safe: initial.safe, providerHomes: authorized.homes };
  return pid;
}
async function verifyRuntime(runtime) {
  assert.equal(runtime.platform, 'win32');
  assert.ok(equalPath(runtime.profile, expectedProfile));
  assert.ok(equalPath(runtime.vault, expectedVault));
  assert.ok(equalPath(await fs.realpath(taskRoot), taskRoot), 'Unexpected junction in the task root');
  assert.ok(equalPath(await fs.realpath(expectedProfile), expectedProfile), 'Unexpected junction in the profile');
  assert.ok(equalPath(await fs.realpath(expectedVault), expectedVault), 'Unexpected junction in the vault');
  for (const key of environmentKeys) {
    assert.ok(runtime.safe[key] && path.win32.isAbsolute(runtime.safe[key]) && inside(taskRoot, runtime.safe[key]), `${key} must already be a fixed-task isolated directory`);
    assert.ok(inside(taskRoot, await fs.realpath(runtime.safe[key])), `${key} cannot resolve outside the task root`);
  }
  const identity = await queryProcess(runtime.pid); assertIdentity(identity, runtime); return identity;
}
async function waitOwnedExit(identity) {
  const deadline = Date.now() + 30000;
  do {
    const current = await queryProcess(identity.ProcessId);
    if (!current || current.CreationTimeUtc !== identity.CreationTimeUtc) return;
    await delay(300);
  } while (Date.now() < deadline);
  throw Error('The owned isolated Obsidian did not quit normally; no forced termination was attempted');
}
async function reconnect() {
  const deadline = Date.now() + 60000;
  do {
    let candidate;
    try {
      candidate = await bounded(connect(), 'restarted CDP connection', 3000);
      await bounded(candidate.evaluate('!!window.app?.plugins?.plugins?.nand?.terminalHost'), 'restarted plugin ready', 3000).then(ready => { assert.ok(ready); });
      return candidate;
    } catch { candidate?.close(); await delay(400); }
  } while (Date.now() < deadline);
  throw Error('The restarted isolated profile did not expose a ready NAND app on CDP 9237');
}
function findLeaf(value, id) {
  if (!value || typeof value !== 'object') return null;
  if (value.id === id && value.state?.type === 'terminal-view') return value;
  for (const child of Object.values(value)) { const found = findLeaf(child, id); if (found) return found; }
  return null;
}
async function readOptional(file) { try { return await fs.readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function waitSavedLayout(file, id, wanted) {
  const deadline = Date.now() + 15000;
  do {
    const raw = await readOptional(file);
    if (raw) { const leaf = findLeaf(JSON.parse(raw), id), state = leaf?.state?.state; if (wanted === null ? !leaf : state && Object.entries(wanted).every(([key, value]) => state[key] === value)) return state || true; }
    await delay(200);
  } while (Date.now() < deadline);
  throw Error('The native workspace file did not save the requested workbench state');
}
async function assertAppGuard() {
  const guard = await bounded(c.evaluate(`(async()=>{const marker=JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json')),p=app.plugins.plugins.nand,h=p.terminalHost,s=await h.getTerminalService();return {marker,vault:app.vault.adapter.basePath,offline:h.settings.serverConnection.offlineMode,disabled:Object.values(h.settings.agentSettings.agents).every(a=>!a.enabled),accounts:Object.values(h.settings.agentSettings.agents).filter(a=>a.accountId).length,defaultShell:h.settings.platformShells.windows,args:h.settings.shellArgs,ids:s.getAllTerminals().map(t=>({id:t.id,agent:t.agentId||null}))}})()`), 'isolated app prerequisites');
  assert.equal(guard.marker.kind, 'nand-windows-e2e'); assert.equal(guard.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE);
  assert.ok(equalPath(guard.marker.vaultPath, expectedVault) && equalPath(guard.vault, expectedVault));
  assert.ok(guard.offline && guard.disabled && guard.accounts === 0, 'No authenticated agent may be enabled');
  assert.ok(['powershell', 'pwsh', 'cmd'].includes(guard.defaultShell), 'Restored leaves may only start a standard Windows shell');
  assert.ok(Array.isArray(guard.args) && guard.args.every(arg => ['-noprofile', '-nologo'].includes(String(arg).toLowerCase())), 'Restored shell arguments must not launch a CLI/prompt');
  assert.ok(guard.ids.every(row => !row.agent), 'Restoration must never launch an authenticated agent');
  return guard;
}

async function main() {
  assert.equal(process.platform, 'win32');
  const endpoint = new URL(process.env.NAND_CDP_URL || 'http://127.0.0.1:9237');
  assert.ok(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname) && endpoint.port === '9237');
  c = await bounded(connect(), 'initial CDP connection');
  initial = await runtimeIdentity(); initial.identity = await verifyRuntime(initial);
  await assertAppGuard();
  authorized = await authorize(c);
  originalEnv = await bounded(c.evaluate('nandWorkbenchAudit.oldEnv'), 'original fixture environment');
  for (const [key, value] of Object.entries(authorized.homes)) assert.ok(inside(authorized.fixture, await fs.realpath(value)), `${key} must resolve into the owned provider fixture`);
  const corpus = await seedHistory(authorized, 1);
  const dailyFile = process.env.APPDATA ? path.join(process.env.APPDATA, 'obsidian', 'obsidian.json') : null;
  const dailyBefore = dailyFile ? await readOptional(dailyFile) : null;
  const digest = text => text === null ? null : createHash('sha256').update(text).digest('hex');
  const setup = await bounded(c.evaluate(`(async()=>{const a=nandWorkbenchAudit,p=app.plugins.plugins.nand,h=p.terminalHost,s=await h.getTerminalService(),leaves=app.workspace.getLeavesOfType('terminal-view');if(leaves.length>1)throw Error('Restart audit requires at most one existing terminal leaf');let leaf=leaves[0];const created=!leaf;if(!leaf){leaf=app.workspace.getLeaf('tab');await leaf.setViewState({type:'terminal-view',active:true});}await leaf.loadIfDeferred();await app.workspace.revealLeaf(leaf);a.leaf=leaf;a.view=leaf.view;const history=s.history(()=>h.settings.agentSettings,h.manifest.dir||'');await history.scan();const page=await history.query(${JSON.stringify(corpus.prefix)},0,undefined,'active');if(page.rows.length!==1)throw Error('Owned history fixture was not found');const device=String(app.loadLocalStorage('nand.automation.device')||'local');if(!/^[A-Za-z0-9_-]+$/.test(device))throw Error('Unsafe history device identity');return {leaf:leaf.id,created,originalState:leaf.view.getState(),oldEnv:a.oldEnv,session:page.rows[0],metadata:'.nand/terminal-agent/'+device+'/history.json',configDir:app.vault.configDir}})()`), 'owned history and leaf setup', 30000);
  ownedLeafId = setup.leaf; createdLeaf = setup.created; originalState = setup.originalState; originalEnv = setup.oldEnv;
  metadataPath = path.resolve(expectedVault, setup.metadata);
  assert.ok(inside(expectedVault, metadataPath)); metadataBefore = await readOptional(metadataPath);
  layoutPath = path.resolve(expectedVault, setup.configDir, 'workspace.json'); assert.ok(inside(expectedVault, layoutPath));
  const patch = { title: `${corpus.prefix} restart title 中文`, tags: [`restart-${corpus.prefix}`], favorite: true, archived: false };
  const wanted = { sidebarWidth: 316, sessionQuery: `RESTART_${corpus.prefix}`, historyQuery: corpus.prefix, historyFilter: 'favorite', navigation: 'history', historyOffset: 0, wideSidebarOpen: true };
  await bounded(c.evaluate(`(async()=>{const a=nandWorkbenchAudit,h=a.host,history=a.service.history(()=>h.settings.agentSettings,h.manifest.dir||'');await history.update(${JSON.stringify(setup.session.key)},${JSON.stringify(patch)});return true})()`), 'persist owned history metadata');
  assert.ok(inside(expectedVault, await fs.realpath(metadataPath)), 'History metadata cannot resolve outside the isolated vault');
  metadataWritten = await fs.readFile(metadataPath, 'utf8'); fixtureChanged = true;
  await bounded(c.evaluate(`(()=>{nandWorkbenchAudit.view.changeWorkbench(${JSON.stringify(wanted)});app.workspace.requestSaveLayout();return true})()`), 'persist test UI state');
  await waitSavedLayout(layoutPath, ownedLeafId, wanted);
  checks.push({ name: 'persist-before-quit', passed: true });
  // Re-query immediately before quitting; neither a remembered PID nor a helper is eligible.
  const claimed = await queryProcess(initial.pid); assertIdentity(claimed, initial);
  assert.equal(claimed.CreationTimeUtc, initial.identity.CreationTimeUtc);
  await bounded(c.evaluate(`(()=>{const electron=window.require('electron'),remote=electron.remote||window.require('@electron/remote');window.setTimeout(()=>remote.app.quit(),200);return true})()`), 'schedule normal owned app quit');
  quitStarted = true; c.close(); c = null; await waitOwnedExit(claimed);
  checks.push({ name: 'owned-main-normal-quit', passed: true, identity: claimed });
  const startedPid = await launchIsolatedApp();
  c = await reconnect(); restarted = await runtimeIdentity(); restarted.identity = await verifyRuntime(restarted);
  assert.equal(restarted.pid, startedPid, 'The connected main app must be the process this script started');
  assert.notEqual(restarted.identity.CreationTimeUtc, initial.identity.CreationTimeUtc);
  assert.deepEqual(restarted.safe, initial.safe); await assertAppGuard();
  restarted.deployment = await deploymentHashes();
  assert.deepEqual(restarted.deployment, expectedHashes(authorized.runtime), 'Restart must retain the exact production main/styles/native deployment');
  checks.push({ name: 'restart-same-profile-safe-child-env', passed: true, identity: restarted.identity, deployment: restarted.deployment });
  const actual = await bounded(until(c, `(async()=>{const p=app.plugins.plugins.nand,h=p.terminalHost,s=await h.getTerminalService(),leaf=app.workspace.getLeavesOfType('terminal-view').find(l=>l.id===${JSON.stringify(ownedLeafId)});if(!leaf)return false;await leaf.loadIfDeferred();const history=s.history(()=>h.settings.agentSettings,h.manifest.dir||'');await history.query(${JSON.stringify(corpus.prefix)},0,undefined,'favorite');return {state:leaf.view.getState(),meta:history.meta(${JSON.stringify(setup.session.key)}),sessions:s.getAllTerminals().map(t=>({id:t.id,agent:t.agentId||null}))}})()`, 'restored workbench leaf', 30000), 'restored workbench state and metadata', 35000);
  for (const [key, value] of Object.entries(wanted)) assert.equal(actual.state[key], value, `Restored ${key}`);
  assert.deepEqual(actual.meta, patch, 'Custom title/tags/favorite/archive metadata survives a real app restart');
  assert.ok(actual.sessions.every(row => !row.agent), 'No agent prompt is replayed');
  checks.push({ name: 'layout-query-and-history-metadata-survive', passed: true, actual });
  const dailyAfter = dailyFile ? await readOptional(dailyFile) : null;
  assert.equal(digest(dailyAfter), digest(dailyBefore), 'The daily Obsidian config remains unchanged');
  checks.push({ name: 'daily-config-unchanged', passed: true, path: dailyFile, beforeSha256: digest(dailyBefore), afterSha256: digest(dailyAfter) });
}

async function verifyAfterReturn() {
  assert.equal(process.env.NAND_ALLOW_WINDOWS_E2E, '1');
  assert.ok(process.env.NAND_WINDOWS_E2E_NONCE);
  assert.ok(path.isAbsolute(process.env.NAND_ACCEPTANCE_DIR || ''));
  const evidence = path.join(process.env.NAND_ACCEPTANCE_DIR, 'terminal-restart.json');
  const result = JSON.parse(await fs.readFile(evidence, 'utf8'));
  assert.ok(result.checksPassed && result.restarted && result.launch, 'The complete restart checks must pass before independent verification');
  assert.ok(equalPath(result.taskProfile, expectedProfile));
  c = await bounded(connect(), 'independent post-return CDP connection');
  try {
    const runtime = await runtimeIdentity(); runtime.identity = await verifyRuntime(runtime);
    assert.equal(runtime.pid, result.restarted.pid);
    assert.equal(runtime.identity.CreationTimeUtc, result.restarted.identity.CreationTimeUtc);
    assert.deepEqual(runtime.safe, result.initial.safe);
    const guard = await assertAppGuard(); assert.equal(guard.ids.length, 0, 'Independent verification must observe cleaned-up test terminals');
    const deployment = await deploymentHashes(); assert.deepEqual(deployment, expectedHashes(result.runtime));
    const daily = result.checks.find(check => check.name === 'daily-config-unchanged');
    const raw = daily.path ? await readOptional(daily.path) : null;
    const dailySha256 = raw === null ? null : createHash('sha256').update(raw).digest('hex');
    assert.equal(dailySha256, daily.beforeSha256, 'The daily config remains unchanged after the launcher returns');
    result.postReturnVerification = { passed: true, verifiedAtUtc: new Date().toISOString(), runtime, deployment, sessions: guard.ids.length, dailySha256 };
    result.passed = true; result.requiresPostReturnVerification = false;
    await fs.writeFile(evidence, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ passed: true, cases: result.cases, postReturnVerification: true, pid: runtime.pid, evidence }));
  } finally { c?.close(); }
}

async function runRestart() {
let failure;
try { await main(); } catch (error) { failure = error; }
finally {
  try {
    if (fixtureChanged && metadataPath) {
      const current = await readOptional(metadataPath);
      assert.ok(current === metadataWritten, 'Unexpected concurrent metadata change: restoration stopped');
      if (metadataBefore === null) await fs.unlink(metadataPath); else await fs.writeFile(metadataPath, metadataBefore);
    }
    if (c && authorized) {
      await assertAppGuard();
      await bounded(c.evaluate(`(async()=>{const p=app.plugins.plugins.nand,h=p.terminalHost,s=await h.getTerminalService(),leaf=app.workspace.getLeavesOfType('terminal-view').find(l=>l.id===${JSON.stringify(ownedLeafId)}),history=s.history(()=>h.settings.agentSettings,h.manifest.dir||'');if(leaf){leaf.view.releaseTerminalInstance();if(${JSON.stringify(createdLeaf)})leaf.detach();else leaf.view.changeWorkbench(${JSON.stringify(originalState || {})});}for(const terminal of s.getAllTerminals()){if(terminal.agentId)throw Error('Unexpected authenticated session; cleanup stopped');await s.destroyTerminal(terminal.id);}const process=window.require('process');for(const [key,value]of Object.entries(${JSON.stringify(originalEnv || {})})){if(value===null)delete process.env[key];else process.env[key]=value;}if(${JSON.stringify(fixtureChanged)}){history.metadata=${metadataBefore === null || metadataBefore === undefined ? '{}' : metadataBefore};history.changed();}delete window.nandWorkbenchAudit;app.workspace.requestSaveLayout();return s.getAllTerminals().length})()`), 'restore fixture changes and end owned test shells', 30000).then(count => assert.equal(count, 0));
      if (layoutPath && ownedLeafId) await waitSavedLayout(layoutPath, ownedLeafId, createdLeaf ? null : originalState);
      checks.push({ name: 'restore-and-terminal-cleanup', passed: true });
    } else if (quitStarted) {
      checks.push({ name: 'restore-and-terminal-cleanup', passed: false, reason: 'Restart did not reconnect; no other app was touched' });
    }
  } catch (error) { failure = failure ? new AggregateError([failure, error], 'Restart acceptance and cleanup failed') : error; }
  c?.close();
  if (authorized) {
    const result = { passed: false, checksPassed: !failure, requiresPostReturnVerification: !failure, error: failure ? String(failure) : null, runtime: authorized.runtime, initial, restarted, launch, fixture: authorized.fixture, checks, cases: checks.length, taskProfile: expectedProfile, noPromptSubmitted: true };
    await fs.writeFile(path.join(authorized.dir, 'terminal-restart.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ passed: result.passed, checksPassed: result.checksPassed, requiresPostReturnVerification: result.requiresPostReturnVerification, cases: result.cases, evidence: path.join(authorized.dir, 'terminal-restart.json') }));
  }
}
if (failure) { console.error(failure); process.exitCode = 1; }
}
try { await (process.argv.includes('--verify-after-return') ? verifyAfterReturn() : runRestart()); }
catch (error) { console.error(error); process.exitCode = 1; }
