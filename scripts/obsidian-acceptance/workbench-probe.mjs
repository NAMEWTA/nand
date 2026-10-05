// Runs only in the nonce-marked disposable native Vault created by the fresh launcher.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { connect } from './cdp.mjs';
assert.equal(process.env.NAND_ALLOW_BROWSER_E2E, '1');
for (const key of ['NAND_ACCEPTANCE_DIR', 'NAND_ACCEPTANCE_VAULT', 'NAND_ACCEPTANCE_PROFILE']) assert.ok(path.isAbsolute(process.env[key] || ''), key);
assert.match(process.env.NAND_EXPECT_MAIN_SHA || '', /^[a-f0-9]{64}$/);
assert.ok(process.env.NAND_WINDOWS_E2E_NONCE);
const dir = process.env.NAND_ACCEPTANCE_DIR, c = await connect(), checks = [];
const restart = process.argv.includes('--verify-restart');
let server;
const call = (expression) => Promise.race([c.evaluate(expression), delay(20000).then(() => { throw Error('Native evaluation timeout: ' + expression.slice(0, 100)); })]);
async function until(expression, label) {
 const end = Date.now() + 15000;
 while (Date.now() < end) { const result = await call(expression); if (result) return result; await delay(75); }
 throw Error('Native condition timed out: ' + label);
}
const check = (name, detail = {}) => { checks.push({ name, passed: true, ...detail }); console.log(name, JSON.stringify(detail)); };
async function shot(name) { await fs.writeFile(path.join(dir, name + '.png'), Buffer.from((await c.send('Page.captureScreenshot')).data, 'base64')); }
const wb = "app.workspace.getLeavesOfType('nand-workbench-view')[0]?.view";
let runtime;
try {
 await fs.mkdir(dir, { recursive: true });
 runtime = await call(`(async()=>{const p=app.plugins.plugins.nand;return {vault:app.vault.adapter.basePath,profile:require('@electron/remote').app.getPath('userData'),marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json')),version:require('@electron/remote').app.getVersion(),mainSha256:require('crypto').createHash('sha256').update(require('fs').readFileSync(app.vault.adapter.basePath+'/'+p.manifest.dir+'/main.js')).digest('hex')}})()`);
 assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE);
 assert.equal(path.resolve(runtime.vault), path.resolve(process.env.NAND_ACCEPTANCE_VAULT));
 assert.equal(path.resolve(runtime.profile), path.resolve(process.env.NAND_ACCEPTANCE_PROFILE));
 assert.equal(runtime.mainSha256, process.env.NAND_EXPECT_MAIN_SHA);
 assert.equal(createHash('sha256').update(await fs.readFile('main.js')).digest('hex'), runtime.mainSha256);
 assert.equal(runtime.version, '1.13.7');
 await call(`(()=>{window.nandWorkbenchErrors=[];window.nandWorkbenchErrorHandler=e=>nandWorkbenchErrors.push(String(e.reason??e.error??e.message));window.addEventListener('unhandledrejection',nandWorkbenchErrorHandler);window.addEventListener('error',nandWorkbenchErrorHandler);app.setting.close();})()`);
 if (restart) {
  await until(`${wb}?.getState().target?.feature==='contacts'`, 'persisted workbench page');
  await until(`!!${wb}?.contentEl.querySelector('.nand-contacts')`, 'restored archive presentation');
  check('native-normal-restart-restores-workbench-and-selected-feature');
  await shot('restart-restored-archives');
 } else {
  await call(`(async()=>{const f=app.vault.getFileByPath('Welcome.md');await app.workspace.getLeaf('tab').openFile(f);await app.plugins.plugins.nand.openWorkbench({feature:'dashboard'});})()`);
  const initial = await until(`(()=>{const v=${wb};const s=v?.getNativeSurfaces().find(s=>s.getViewType()==='nand-dashboard-view');return s?.data&&{id:v.leaf.id,target:v.getState().target,columns:s.data.columns.length,notes:app.workspace.getLeavesOfType('markdown').map(l=>l.view.file?.path)}})()`, 'real dashboard in workbench');
  assert.ok(initial.columns > 0); assert.equal(initial.target.feature, 'dashboard'); assert.ok(initial.notes.includes('Welcome.md'));
  check('home-is-real-dashboard-without-overwriting-the-note', initial);
  const ribbons = await call(`app.workspace.leftRibbon.items.filter(i=>i.id.startsWith('nand:')).map(i=>({id:i.id,title:i.title}))`);
  assert.equal(ribbons.length, 1); assert.equal(ribbons[0].id, 'nand:ribbon-home'); check('one-native-ribbon-registration', { ribbons });
  await shot('home-zh-wide');
  for (const target of [{feature:'contacts',section:'person'}, {feature:'contacts',section:'company'}, {feature:'automations',section:'tasks'}, {feature:'automations',section:'runs'}, {feature:'notifications'}, {feature:'dashboard'}]) {
   await call(`app.plugins.plugins.nand.openWorkbench(${JSON.stringify(target)})`);
   const state = await call(`({id:${wb}.leaf.id,target:${wb}.getState().target,count:app.workspace.getLeavesOfType('nand-workbench-view').length})`);
   assert.equal(state.id, initial.id); assert.equal(state.count, 1); assert.equal(state.target.feature, target.feature);
   check('same-native-leaf-' + target.feature + '-' + (target.section || 'root'), state);
  }
  await call(`(async()=>{const p=app.plugins.plugins.nand;p.settings.modules.terminal=true;await p.saveSettings();await p.openWorkbench({feature:'terminal',section:'running'});})()`);
  for (const section of ['running','history','usage','running']) {
   await call(`app.plugins.plugins.nand.openWorkbench({feature:'terminal',section:${JSON.stringify(section)}})`);
   const count = await call(`app.plugins.plugins.nand.terminalHost.getRuntimeStatus().length`);
   assert.equal(count, 0); check('agent-navigation-does-not-create-pty-' + section);
  }
  await shot('agent-no-implicit-session');
  const saved = await call(`(async()=>{const v=${wb};for(let i=0;i<8;i++){const a=v.navigate({feature:'contacts',section:'person'});const b=v.navigate({feature:'automations',section:'runs'});await Promise.all([a,b]);}return v.getState().target})()`);
  assert.equal(saved.feature, 'automations'); check('rapid-navigation-latest-target-wins', saved);
  await call(`(async()=>{const p=app.plugins.plugins.nand;await p.openWorkbench({feature:'contacts'});p.settings.modules.contacts=false;await p.saveSettings();})()`);
  assert.equal(await call(`${wb}.getNativeSurfaces().filter(s=>s.getViewType()==='nand-contacts-view').length`), 0);
  assert.ok(await call(`!!${wb}.contentEl.querySelector('.nand-workbench-unavailable')`));
  await call(`(async()=>{const p=app.plugins.plugins.nand;p.settings.modules.contacts=true;await p.saveSettings();await p.openWorkbench({feature:'contacts'});})()`);
  assert.equal(await call(`${wb}.getNativeSurfaces().filter(s=>s.getViewType()==='nand-contacts-view').length`), 1);
  check('module-disable-releases-presentation-reenable-restores-once');
  server = createServer((_request, response) => { response.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); response.end('<!doctype html><title>NAND owned workbench fixture</title><h1>Native browser fixture</h1><input aria-label="Fixture draft" value="unsent draft">'); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  await call(`app.plugins.plugins.nand.openBrowser({url:${JSON.stringify(url)}})`);
  const browser = await until(`(()=>{const s=${wb}.getNativeSurfaces().find(s=>s.getViewType()==='nand-browser-view');return s?.state.title==='NAND owned workbench fixture'&&{id:s.state.id,url:s.state.url}})()`, 'real browser guest navigation');
  await call(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard'})`);
  await call(`app.plugins.plugins.nand.openWorkbench({feature:'browser'})`);
  assert.equal(await call(`${wb}.getState().target.resourceId`), browser.id);
  check('browser-real-guest-identity-survives-ordinary-switch', browser); await shot('browser-native-guest');
  await call(`(async()=>{const s=${wb}.getNativeSurfaces().find(s=>s.getViewType()==='nand-browser-view');await s.context.close();})()`);
  assert.equal(await call(`app.workspace.getLeavesOfType('nand-workbench-view').length`), 1);
  assert.equal(await call(`${wb}.getNativeSurfaces().filter(s=>s.getViewType()==='nand-browser-view').length`), 0);
  check('closing-browser-resource-does-not-close-workbench');
  for (const lang of ['zh','en']) {
   await call(`(async()=>{const p=app.plugins.plugins.nand;await p.changeLanguage(${JSON.stringify(lang)});await p.openWorkbench({feature:'contacts',section:'person'});})()`);
   for (const width of [1120,640,448,288]) {
    await call(`(()=>{const v=${wb};v.contentEl.style.width='${width}px';v.contentEl.style.maxWidth='100%';})()`); await delay(120);
    const layout = await call(`(()=>{const root=${wb}.contentEl.querySelector('.nand-workbench');const header=root.querySelector('.nand-workbench-header');return {width:root.clientWidth,compact:root.classList.contains('is-compact'),headerWidth:header.scrollWidth,headerClient:header.clientWidth,labels:[...root.querySelectorAll('.nand-workbench-nav-row>.nand-workbench-nav-link')].map(e=>e.textContent)}})()`);
    assert.ok(layout.headerWidth <= layout.headerClient + 2); assert.equal(layout.compact, layout.width < 760);
    check('native-layout-' + lang + '-' + width, layout); await shot('archives-' + lang + '-' + width);
   }
  }
  await call(`(()=>{const v=${wb};v.contentEl.style.width='';v.contentEl.style.maxWidth='';app.plugins.plugins.nand.openSettings();})()`);
  assert.equal(await call(`${wb}.getState().target.feature`), 'contacts'); check('settings-do-not-replace-home-or-selected-content');
  await call(`app.setting.close()`);
  for (const type of ['nand-dashboard-view','nand-contacts-view','nand-automation-view','nand-editor-view','nand-browser-view']) {
   const actual = await call(`(async()=>{const leaf=app.workspace.getLeaf('tab');await leaf.setViewState({type:${JSON.stringify(type)},active:true});const result={type:leaf.view.getViewType(),title:leaf.view.getDisplayText()};leaf.detach();return result})()`);
   assert.equal(actual.type, type); check('original-native-view-remains-real-' + type, actual);
  }
  await call(`(async()=>{const p=app.plugins.plugins.nand;p.settings.modules.terminal=false;await p.saveSettings();const leaf=app.workspace.getLeaf('tab');await leaf.setViewState({type:'terminal-view',active:true});if(leaf.view.getViewType()!=='terminal-view')throw Error('Lost terminal identity');leaf.detach();await p.openWorkbench({feature:'contacts',section:'person'});app.workspace.requestSaveLayout();})()`);
  check('original-disabled-terminal-identity-and-safe-placeholder');
  await delay(1500);
 }
 const errors = await call(`window.nandWorkbenchErrors`); assert.deepEqual(errors, []);
 check('no-unhandled-native-errors');
 await fs.writeFile(path.join(dir, 'result.json'), JSON.stringify({passed:true,restart,runtime,sourceCommit:process.env.GITHUB_SHA,checks},null,2));
} catch (error) {
 try { await shot('failure'); } catch {}
 await fs.writeFile(path.join(dir,'result.json'),JSON.stringify({passed:false,restart,runtime,checks,error:String(error)},null,2));
 throw error;
} finally {
 try { await call(`(()=>{window.removeEventListener('error',window.nandWorkbenchErrorHandler);window.removeEventListener('unhandledrejection',window.nandWorkbenchErrorHandler)})()`); } catch {}
 server?.close(); c.close();
}
