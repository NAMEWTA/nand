import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function until(c, expression, label, timeout = 12000) {
  const deadline = Date.now() + timeout;
  do { const result = await c.evaluate(expression); if (result) return result; await delay(100); } while (Date.now() < deadline);
  throw Error(`Timed out: ${label}`);
}
export async function screenshot(c, dir, name) {
  await fs.writeFile(path.join(dir, `${name}.png`), Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
}
export async function authorize(c) {
  assert.equal(process.env.NAND_ALLOW_WINDOWS_E2E, '1', 'Explicit isolated Windows opt-in required');
  assert.ok(process.env.NAND_WINDOWS_E2E_NONCE, 'Exact isolated vault nonce required');
  assert.ok(path.isAbsolute(process.env.NAND_ACCEPTANCE_DIR || ''), 'Absolute evidence directory required');
  const runtime = await c.evaluate(`(async()=>{const marker=JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json')),host=app.plugins.plugins.nand?.terminalHost;if(!host)throw Error('NAND must already be deployed');const service=await host.getTerminalService(),fs=window.require('fs'),path=window.require('path'),crypto=window.require('crypto'),plugin=path.join(app.vault.adapter.basePath,'.obsidian/plugins/nand'),hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(plugin,file))).digest('hex');return {marker,vault:app.vault.adapter.basePath,platform:window.require('process').platform,offline:host.settings.serverConnection.offlineMode,sessions:service.getAllTerminals().length,agentsDisabled:Object.values(host.settings.agentSettings.agents).every(a=>!a.enabled),customAccountCount:Object.values(host.settings.agentSettings.agents).filter(a=>a.accountId).length,mainSha256:hash('main.js'),stylesSha256:hash('styles.css'),nativeSha256:hash('binaries/rust-terminal-servers-win32-x64.exe')}})()`);
  assert.equal(runtime.marker.kind, 'nand-windows-e2e');
  assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE);
  assert.equal(path.win32.resolve(runtime.marker.vaultPath).toLowerCase(), path.win32.resolve(runtime.vault).toLowerCase());
  assert.equal(runtime.platform, 'win32');
  assert.ok(runtime.offline && runtime.agentsDisabled, 'Use matching offline native binary and no authenticated agents');
  assert.equal(runtime.sessions, 0, 'Start with an empty isolated terminal service');
  assert.equal(runtime.customAccountCount,0,'Fixture homes must not be overridden by configured authenticated accounts');
  if(process.env.NAND_EXPECT_MAIN_SHA)assert.equal(runtime.mainSha256,process.env.NAND_EXPECT_MAIN_SHA,'Exact deployed production build required');
  const dir = process.env.NAND_ACCEPTANCE_DIR;
  await fs.mkdir(dir, { recursive: true });
  const fixture = await fs.mkdtemp(path.join(dir, 'terminal-fixture-'));
  const homes = { CLAUDE_CONFIG_DIR:path.join(fixture,'claude'), CODEX_HOME:path.join(fixture,'codex'), GEMINI_CLI_HOME:path.join(fixture,'gemini-home'), PI_CODING_AGENT_DIR:path.join(fixture,'pi'), GROK_HOME:path.join(fixture,'grok'), XDG_DATA_HOME:path.join(fixture,'xdg') };
  for (const home of Object.values(homes)) await fs.mkdir(home,{recursive:true});
  await c.evaluate(`(async()=>{const host=app.plugins.plugins.nand.terminalHost,service=await host.getTerminalService(),process=window.require('process'),homes=${JSON.stringify(homes)},old={};for(const key of Object.keys(homes)){old[key]=process.env[key]??null;process.env[key]=homes[key];}window.nandWorkbenchAudit={host,service,owned:[],leaves:[],oldEnv:old,fixture:${JSON.stringify(fixture)},originalLanguage:app.plugins.plugins.nand.settings.language,originalTheme:app.vault.getConfig('theme')};const native=host.getBrowserWindowForDomWindow(window);native?.show();native?.restore();native?.focus();app.setting.close();app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();})()`);
  await until(c,`document.visibilityState==='visible'`,'visible Electron window');
  await c.send('Emulation.clearDeviceMetricsOverride');
  await delay(200);
  const deviceScaleFactor=await c.evaluate('window.devicePixelRatio');
  return { runtime, dir, fixture, homes, deviceScaleFactor };
}
export async function openShell(c) {
  await c.evaluate(`nandWorkbenchAudit.shellBefore=nandWorkbenchAudit.service.getAllTerminals().map(s=>s.id);true`);
  await c.evaluate(`app.commands.executeCommandById('nand:new-terminal-powershell')`);
  await until(c, `(()=>{const a=nandWorkbenchAudit;for(const s of a.service.getAllTerminals())if(!a.owned.includes(s.id))a.owned.push(s.id);const next=a.service.getAllTerminals().find(s=>!a.shellBefore.includes(s.id));if(!next)return false;const leaf=app.workspace.getLeavesOfType('terminal-view').find(l=>l.view.terminalInstance?.id===next.id);if(!leaf?.view.terminalInstance?.session?.isAlive())return false;a.leaf=leaf;a.view=leaf.view;if(!a.leaves.includes(leaf))a.leaves.push(leaf);app.workspace.setActiveLeaf(leaf);return true})()`, 'owned PowerShell shell and presentation');
  return c.evaluate(`({id:nandWorkbenchAudit.view.terminalInstance.id,leaf:nandWorkbenchAudit.leaf.id})`);
}
export async function cleanup(c) {
  await c.evaluate(`(async()=>{const a=window.nandWorkbenchAudit;if(!a)return;for(const leaf of a.leaves)if(leaf.view?.getViewType?.()==='terminal-view')leaf.detach();for(const id of a.owned)if(a.service.getTerminal(id))await a.service.destroyTerminal(id);const process=window.require('process');for(const [key,value] of Object.entries(a.oldEnv)){if(value===null)delete process.env[key];else process.env[key]=value;}app.setTheme(a.originalTheme);delete window.nandWorkbenchAudit;})()`);
}
export async function seedHistory(authorized, count = 125) {
  const prefix = `ORCA_${randomUUID().slice(0,8)}`;
  const source = path.join(authorized.homes.CODEX_HOME,'sessions');
  await fs.mkdir(source,{recursive:true});
  for(let n=0;n<count;n++) {
    const rows=[{type:'session_meta',payload:{id:`${prefix}-${n}`,cwd:authorized.runtime.vault}},{type:'response_item',payload:{type:'message',role:'user',content:[{text:`${prefix} history ${n} 中文标题`}] }},{type:'response_item',payload:{type:'message',role:'assistant',content:[{text:(`Long fixture transcript ${prefix} ${n} 中文全文\n`).repeat(300)+`FINAL_${prefix}_${n}`}] }}];
    await fs.writeFile(path.join(source,`${prefix}-${n}.jsonl`),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
  }
  return {prefix,source,count};
}
