// Real Obsidian and two local Electron guests; no provider account or site claims.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { connect } from './cdp.mjs';

let heldResponse;
const server = createServer((request, response) => {
 if (request.url === '/slow') { heldResponse = response; return; }
 response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
 response.end('<!doctype html><title>Control fixture</title><h1>Control fixture</h1><input aria-label="Message"><input aria-label="Other"><input type="password" aria-label="Password" value="fixture-secret"><input name="api_key" aria-label="API key" value="fixture-key"><textarea aria-label="Long message"></textarea><button onclick="document.querySelector(\'output\').textContent=\'sent:\'+document.querySelector(\'input\').value">Send</button><output></output><script>document.querySelector(\'input\').onkeydown=e=>{if(e.key===\'Enter\')document.querySelector(\'button\').click()}</script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`, p = 'app.plugins.plugins.nand', rows = [];
let runtime, c;
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const until = async expression => { const end = Date.now() + 25000; while (Date.now() < end) { if (await c.evaluate(expression)) return; await delay(80); } throw Error(expression); };
const guest = id => `document.querySelector('[data-page-id="${id}"] webview')`;
const script = (id, expression) => c.evaluate(`${guest(id)}.executeJavaScript(${JSON.stringify(expression)})`);
const bind = () => c.evaluate(`window.bc=${p}.services.peek({owner:'browser',id:'control'});window.bp=${p}.services.peek({owner:'browser',id:'profiles'});true`);
try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9276, files: { 'Note.md': '# Foreground\n\nKeep focus here.\n' }, settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: { browser: true, home: false, agent: false, news: false, archives: false, sync: false, comments: false, notifications: false, automations: false, icons: false } } } } }); c = runtime.connection;
 await bind();
 check('control-service-registered', await c.evaluate('!!bc'));
 await c.evaluate(`(async()=>{window.work=await bp.create('Work');window.a=await bc.open({url:${JSON.stringify(url)},profileId:work.id});window.b=await bc.open({url:${JSON.stringify(url)}});})()`);
 const a = await c.evaluate('a'), b = await c.evaluate('b');
 check('two-frozen-targets', a.profileId !== b.profileId && a.pageId !== b.pageId && a.generation !== b.generation);
 await c.evaluate(`window.front=document.querySelector('[data-page-id="${b.pageId}"] .nand-browser-address');front.focus();true`);
 const observed = await c.evaluate('bc.observe(a)');
 check('background-snapshot-identity', observed.target.pageId === a.pageId && observed.target.profileId === a.profileId && observed.snapshot.includes('Control fixture'));
 check('background-read-preserves-host-focus', await c.evaluate('document.activeElement===front'));
 const ref = name => ({ revision: observed.revision, element: observed.refs.find(ref => ref.name === name).ref });
 const message = ref('Message'), send = ref('Send');
 await c.evaluate(`window.message=${JSON.stringify(message)};window.send=${JSON.stringify(send)};true`);
 check('element-read-bound-to-page', (await c.evaluate('bc.readElement(a,send)')).text === 'Send');
 check('background-element-read-preserves-host-focus', await c.evaluate('document.activeElement===front'));
 for (const name of ['Password', 'API key']) {
  const value = await c.evaluate(`bc.readElement(a,${JSON.stringify(ref(name))})`);
  check(`${name}-readback-omits-credential-value`, !('value' in value) && !('value' in value.attributes) && value.text === '' && !JSON.stringify(value).includes(name === 'Password' ? 'fixture-secret' : 'fixture-key'));
 }
 check('hidden-screenshot-requires-explicit-reveal', await c.evaluate(`bc.screenshot(a).then(()=>false,e=>e.code==='browser_capture_not_visible')`));
 const shot = await c.evaluate('bc.screenshot(b)');
 check('visible-screenshot-returns-image', /^data:image\/png;base64,/.test(shot));
 check('screenshot-preserves-host-focus', await c.evaluate('document.activeElement===front'));
 check('hidden-input-requires-explicit-reveal', await c.evaluate(`bc.act(a,{kind:'fill',ref:message,value:'Only A'}).then(()=>false,e=>e.code==='browser_input_not_visible')`));
 check('rejected-input-preserves-host-focus', await c.evaluate('document.activeElement===front'));
 await c.evaluate('bc.activate(a)');
 await c.evaluate(`bc.act(a,{kind:'fill',ref:message,value:'Only A'})`);
 const filled = await script(a.pageId, '({value:document.querySelector("input").value,active:document.activeElement?.outerHTML,focused:document.hasFocus()})');
 check('visible-fill-hits-bound-guest', filled.value === 'Only A' && await script(b.pageId, 'document.querySelector("input").value') === '', filled);
 check('typed-element-readback-verifies-staged-composer', (await c.evaluate('bc.readElement(a,message)')).value === 'Only A');
 check('input-focus-is-confined-to-visible-guest', await c.evaluate(`document.activeElement===${guest(a.pageId)}`));
 await c.evaluate(`bc.act(a,{kind:'fill',ref:${JSON.stringify(ref('Long message'))},value:${JSON.stringify('First line\nSecond line')}})`);
 check('textarea-readback-preserves-multiline-prompt', (await c.evaluate(`bc.readElement(a,${JSON.stringify(ref('Long message'))})`)).value === 'First line\nSecond line');
 await script(a.pageId, 'document.querySelectorAll("input")[1].focus();true');
 await c.evaluate(`bc.act(a,{kind:'keypress',ref:message,key:'Enter'})`);
 check('keypress-ref-overrides-guest-focus-drift', await script(a.pageId, 'document.querySelector("output").textContent') === 'sent:Only A');
 const next = await c.evaluate('bc.observe(a)');
 check('new-snapshot-invalidates-old-ref', await c.evaluate(`bc.act(a,{kind:'click',ref:send}).then(()=>false,e=>e.code==='browser_stale_ref')`));
 await c.evaluate(`bc.act(a,{kind:'fill',ref:${JSON.stringify({ revision: next.revision, element: next.refs.find(r => r.name === 'Message').ref })},value:'Second'})`);
 await c.evaluate(`bc.act(a,{kind:'click',ref:${JSON.stringify({ revision: next.revision, element: next.refs.find(r => r.name === 'Send').ref })}})`);
 check('native-click-hits-bound-guest', await script(a.pageId, 'document.querySelector("output").textContent') === 'sent:Second' && await script(b.pageId, 'document.querySelector("output").textContent') === '');
 check('wrong-profile-rejected', await c.evaluate(`bc.observe({...a,profileId:b.profileId}).then(()=>false,e=>e.code==='browser_stale_target')`));
 await c.evaluate(`(async()=>{window.noteLeaf=app.workspace.getLeaf('tab');await noteLeaf.openFile(app.vault.getAbstractFileByPath('Note.md'));noteLeaf.view.editor.focus();window.noteFocus=document.activeElement;})()`);
 await c.evaluate('bc.observe(a)');
 check('background-read-preserves-editor-focus', await c.evaluate('app.workspace.activeLeaf===noteLeaf&&document.activeElement===noteFocus'));
 await c.evaluate('bc.activate(a)');
 check('explicit-activation-reveals-target', await c.evaluate(`${guest(a.pageId)}.getBoundingClientRect().width>0`));
 // Native navigation holds the existing queue; closing must reject both the active and queued operations.
 await c.evaluate(`window.closedResults=[];bc.act(b,{kind:'navigate',url:${JSON.stringify(url + 'slow')}}).then(()=>closedResults.push('unexpected-navigation'),e=>closedResults.push(e.code));bc.act(b,{kind:'navigate',url:${JSON.stringify(url + 'must-not-run')}}).then(()=>closedResults.push('unexpected-queued'),e=>closedResults.push(e.code));true`);
 for (let i = 0; i < 100 && !heldResponse; i++) await delay(50);
 assert.ok(heldResponse, 'Native navigation did not reach fixture');
 await c.evaluate('bc.close(b)');
 await until('closedResults.length===2');
 check('close-settles-active-and-queued-work', await c.evaluate(`closedResults.every(code=>code==='browser_page_closed'||code==='browser_stale_target')`), await c.evaluate('closedResults'));
 heldResponse.end('<title>Late response</title>');
 check('closed-target-never-rebound', await c.evaluate(`bc.observe(b).then(()=>false,e=>e.code==='browser_stale_target')`));
 // Moving the same page to another host window creates a new guest generation.
 const targets = new Set((await (await fetch(process.env.NAND_CDP_URL + '/json')).json()).map(t => t.id));
 await c.evaluate(`window.browserLeaf=app.workspace.getLeavesOfType('nand-workbench-view').find(l=>l.view.getNativeSurfaces().some(s=>s.state?.id===a.pageId));app.workspace.moveLeafToPopout(browserLeaf,{width:1000,height:900});true`);
 let target; for (let i = 0; i < 100 && !target; i++) { target = (await (await fetch(process.env.NAND_CDP_URL + '/json')).json()).find(t => t.type === 'page' && !targets.has(t.id)); if (!target) await delay(100); }
 assert.ok(target); const popup = await connect(target.url, target.id);
 await until(`bc.list().some(row=>row.target.pageId===a.pageId&&row.target.generation!==a.generation)`);
 check('replacement-rejects-old-generation', await c.evaluate(`bc.observe(a).then(()=>false,e=>e.code==='browser_stale_target')`));
 check('replacement-keeps-page-and-profile', await c.evaluate(`(()=>{const t=bc.list().find(row=>row.target.pageId===a.pageId).target;return t.profileId===a.profileId&&t.generation!==a.generation})()`));
 await c.evaluate('window.fresh=bc.list().find(row=>row.target.pageId===a.pageId).target;true');
 check('replacement-can-be-observed-explicitly', (await c.evaluate('bc.observe(fresh)')).target.profileId === a.profileId);
 popup.close();
 await c.evaluate(`${p}.setModuleEnabled('browser',false)`);
 check('module-off-unregisters-control', await c.evaluate(`!${p}.services.peek({owner:'browser',id:'control'})`));
 check('retained-facade-rejects-disabled-module', await c.evaluate(`Promise.resolve().then(()=>bc.observe(fresh)).then(()=>false,e=>e.code==='browser_disabled')`));
 await c.evaluate(`${p}.setModuleEnabled('browser',true)`); await bind();
 check('module-reenable-rejects-old-target', await c.evaluate(`bc.observe(fresh).then(()=>false,e=>e.code==='browser_stale_target')`));
 check('no-host-errors', await c.evaluate('nandAcceptanceErrors.length') === 0, await c.evaluate('nandAcceptanceErrors'));
 await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ method: 'Real Obsidian and local Electron guests; actual background CDP input, native navigation, close, popout replacement and module lifecycle.', rows }, null, 2));
} catch (error) {
 if (runtime) await fs.writeFile(path.join(runtime.evidence, 'partial.json'), JSON.stringify({ rows, error: String(error), errors: await c.evaluate('window.nandAcceptanceErrors??[]'),
  focus: await c.evaluate('(async()=>({active:document.activeElement?.outerHTML,focused:document.hasFocus(),guests:await Promise.all([...document.querySelectorAll("webview")].map(async w=>{const g=require("@electron/remote").webContents.fromId(w.getWebContentsId());return{id:w.getWebContentsId(),focused:g.isFocused(),inner:await g.executeJavaScript("({active:document.activeElement?.outerHTML,focus:document.hasFocus()})")}}))}))()').catch(String) }, null, 2));
 throw error;
} finally {
 if (runtime) { console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length, failed: rows.filter(r => !r.passed) })); await runtime.stop(); }
 server.closeAllConnections(); server.close();
}
