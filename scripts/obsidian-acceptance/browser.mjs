// Real desktop acceptance. Only the explicitly marked, isolated vault may run this.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { connect } from './cdp.mjs';

assert.equal(process.env.NAND_ALLOW_BROWSER_E2E, '1');
assert.ok(process.env.NAND_WINDOWS_E2E_NONCE);
assert.ok(path.isAbsolute(process.env.NAND_ACCEPTANCE_DIR || ''));
const dir = process.env.NAND_ACCEPTANCE_DIR;
const c = await connect();
const rows = [], owned = [];
rows.push = (...items) => { console.log(items.map((item) => item.name).join(', ')); return Array.prototype.push.apply(rows, items); };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fixture = http.createServer((req, res) => {
	if (req.url === '/hang') return;
	res.setHeader('Content-Type', 'text/html; charset=utf-8');
	if (req.url === '/redirect') { res.writeHead(302, { Location: '/board?redirect=1' }); res.end(); return; }
	if (req.url === '/download') { res.setHeader('Content-Disposition', 'attachment; filename="nand-browser-test.txt"'); res.end('NAND browser download'); return; }
	if (req.url === '/iframe') { res.end('<title>Cross origin</title><button id="child" onclick="this.textContent=\'Frame clicked\'">Frame button</button><input aria-label="Frame input">'); return; }
	if (req.url === '/oauth') { res.end('<script>document.cookie="login=success; SameSite=Lax; path=/";opener.postMessage("NAND_LOGIN_OK","*");window.close()</script>'); return; }
	res.setHeader('X-Frame-Options', 'DENY');
	res.end(`<!doctype html><meta charset="utf-8"><title>NAND Browser Fixture</title><style>body{font:16px system-ui;margin:36px;background:#f8fafc;color:#172334}button,input,select{font:inherit;padding:10px;margin:5px;border-radius:8px;border:1px solid #c8d2df}h1{font-size:28px}section{margin:24px 0}iframe{width:500px;height:160px}#spacer{height:1200px}</style><h1>NAND · Browser acceptance</h1><p>Native tabs · shared session · same-page automation</p><section><button id="click" onclick="this.textContent='Clicked'">Click me</button><button>Duplicate</button><button>Duplicate</button><input id="name" aria-label="Name"><select aria-label="Choice"><option value="a">Alpha</option><option value="b">Beta</option></select><label><input type="checkbox" id="check">Remember</label></section><section><button id="spa" onclick="history.pushState({},'', '/board?spa=1');document.title='SPA updated'">SPA route</button><button id="newtab" onclick="window.open('/child','_blank')">New tab</button><button id="login" onclick="window.open('/oauth','nand-login','width=420,height=500')">Login popup</button><a href="/download">Download</a></section><div id="custom" tabindex="0" style="cursor:pointer" onclick="this.textContent='Custom clicked'">Custom control</div><iframe title="Cross origin" src="http://localhost:${fixture.address().port}/iframe"></iframe><div id="spacer"></div><p>End of page</p><script>window.addEventListener('message',e=>{if(e.data==='NAND_LOGIN_OK')document.body.dataset.login='ok'});document.cookie='session=NAND; SameSite=Lax; path=/';console.log('NAND fixture loaded');</script>`);
});
await new Promise((resolve) => fixture.listen(0, resolve));
const base = `http://127.0.0.1:${fixture.address().port}`;
const call = (method, params = {}) => c.evaluate(`app.plugins.plugins.nand.browserHost.execute(${JSON.stringify(method)},${JSON.stringify(params)})`);
const pageEval = (page, script) => c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get(${JSON.stringify(page)}).guest.executeJavaScript(${JSON.stringify(script)},true)`);
async function until(fn, label, timeout = 10000) {
	const deadline = Date.now() + timeout;
	do { const value = await fn(); if (value) return value; await delay(100); } while (Date.now() < deadline);
	throw Error(`Timed out: ${label}`);
}
async function snapshot(page) { await delay(100); return call('snapshot', { page }); }
async function ref(page, name) { const state = await snapshot(page); const entry = state.refs.find((entry) => entry.name === name); assert.ok(entry, `Missing ${name}: ${state.snapshot}`); return { page, revision: state.revision, element: entry.ref }; }
async function click(page, name) { return call('click', await ref(page, name)); }
async function create(url = base + '/board', target = 'tab') {
	const id = await c.evaluate(`app.plugins.plugins.nand.browserHost.open(${JSON.stringify({ url, target })})`); owned.push(id); return id;
}
async function saveImage(name, data) { await fs.writeFile(path.join(dir, name + '.png'), Buffer.from(data.slice(data.indexOf(',') + 1), 'base64')); }
try {
	const runtime = await c.evaluate(`(async()=>({marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json')),vault:app.vault.adapter.basePath,version:app.version,electron:process.versions.electron}))()`);
	assert.equal(runtime.marker.kind, 'nand-windows-e2e'); assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE); assert.equal(path.resolve(runtime.vault), path.resolve(runtime.marker.vaultPath));
	await fs.mkdir(dir, { recursive: true });
	await c.evaluate(`(()=>{const win=window.require('@electron/remote').getCurrentWindow();win.show();win.focus()})()`);
	// These are browser leaves from earlier runs in the same explicitly isolated vault.
	await c.evaluate(`app.workspace.getLeavesOfType('nand-browser-view').forEach(l=>l.detach())`);
	await delay(200);
	const baseline = await c.evaluate(`window.require('@electron/remote').webContents.getAllWebContents().filter(w=>w.getType()==='webview').length`);
	const page = await create(base + '/redirect');
	console.log('Created fixture page', page);
	await until(() => pageEval(page, 'document.readyState === "complete"'), 'fixture loaded');
	let snap = await snapshot(page); assert.ok(snap.refs.some((r) => r.name === 'Duplicate (2nd)')); assert.ok(snap.refs.some((r) => r.name === 'Custom control')); assert.ok(snap.refs.some((r) => r.name === 'Frame button'));
	console.log('Snapshot ready');
	await click(page, 'Click me'); assert.equal(await pageEval(page, 'document.querySelector("#click").textContent'), 'Clicked');
	await call('fill', { ...await ref(page, 'Name'), value: '中文输入 NAND' }); assert.equal(await pageEval(page, 'document.querySelector("#name").value'), '中文输入 NAND');
	await call('select', { ...await ref(page, 'Choice'), value: 'b' }); await call('check', { ...await ref(page, 'Remember'), checked: true });
	await click(page, 'Custom control'); assert.equal(await pageEval(page, 'document.querySelector("#custom").textContent'), 'Custom clicked');
	await click(page, 'Frame button'); assert.ok((await snapshot(page)).snapshot.includes('Frame clicked'));
	await call('fill', { ...await ref(page, 'Frame input'), value: 'cross frame' });
	rows.push({ name: 'navigation-snapshot-actions', passed: true, crossOrigin: true, chinese: true });
	const old = await ref(page, 'Clicked'); await click(page, 'SPA route'); await delay(150); await assert.rejects(call('click', old), /browser_stale_ref/);
	await assert.rejects(call('snapshot', { page: 'wrong-page' }), /browser_tab_not_found/);
	await call('wait', { page, url: 'spa=1', load: 'load' });
	rows.push({ name: 'stable-page-id-stale-reference-spa', passed: true });
	// Editing remains stable even while the page title and route change.
	await c.evaluate(`(()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${page}'),input=p.webview.closest('.nand-browser-panel').querySelector('input.nand-browser-address');input.focus();input.value='editing.example';input.dispatchEvent(new input.win.Event('input',{bubbles:true}))})()`);
	await pageEval(page, 'history.pushState({},"","/board?edit=1");document.title="Changed while editing"'); await delay(150);
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closest('.nand-browser-panel').querySelector('input.nand-browser-address').value`), 'editing.example');
	await click(page, 'Login popup'); await until(() => pageEval(page, 'document.body.dataset.login === "ok"'), 'OAuth opener');
	const modal = await create(base + '/board', 'modal'); assert.ok((await pageEval(modal, 'document.cookie')).includes('login=success'));
	await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${modal}').webview.closest('.nand-browser-panel').querySelector('button[aria-label="Open in tab"]').click()`);
	await until(async () => !(await call('tab.list')).tabs.some((p) => p.id === modal), 'modal transferred');
	const converted = (await call('tab.list')).tabs.find((p) => p.id !== page)?.id; assert.ok(converted); owned.push(converted);
	assert.ok((await pageEval(converted, 'document.cookie')).includes('login=success'));
	await click(page, 'New tab'); await until(async () => (await call('tab.list')).tabs.length >= 3, 'new tab link');
	for (const row of (await call('tab.list')).tabs) if (!owned.includes(row.id)) owned.push(row.id);
	rows.push({ name: 'popup-opener-cookie-modal-tab-newtab', passed: true });
	await call('tab.switch', { page });
	const png = (await call('screenshot', { page })).dataUrl; await saveImage('browser-page', png); const full = (await call('screenshot', { page, full: true })).dataUrl; await saveImage('browser-full-page', full);
	assert.ok(Buffer.from(full.split(',')[1], 'base64').readUInt32BE(20) > Buffer.from(png.split(',')[1], 'base64').readUInt32BE(20));
	await call('viewport', { page, width: 700, height: 500 }); assert.equal(await pageEval(page, 'innerWidth'), 700); await call('viewport', { page, width: 0, height: 0 });
	await call('scroll', { page, direction: 'down', amount: 400 }); assert.ok(await pageEval(page, 'scrollY > 0')); await call('scroll', { page, direction: 'up', amount: 400 });
	await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${page}');p.zoom(1.25);await p.guest.executeJavaScript('scrollTo(0,0)');await new Promise(r=>setTimeout(r,200));window.nandBrowserGrab=null;await p.automation.design(grab=>{window.nandBrowserGrab=grab});const d=await p.guest.debugger.sendCommand('Runtime.evaluate',{expression:'(()=>{const r=document.querySelector("h1").getBoundingClientRect();return {x:r.x+20,y:r.y+15}})()',returnByValue:true});await p.guest.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',...d.result.value});await p.guest.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...d.result.value});await p.guest.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...d.result.value})})()`);
	const grab = await until(() => c.evaluate('window.nandBrowserGrab'), 'Design Mode selection'); assert.ok(grab.html.includes('h1')); assert.ok(grab.styles); assert.equal(grab.source, null); assert.ok(grab.screenshot); await saveImage('browser-element', grab.screenshot);
	rows.push({ name: 'screenshots-viewport-scroll-design', passed: true, selected: grab.selector, rect: grab.rect, zoom: 1.25 });
	const env = await c.evaluate(`app.plugins.plugins.nand.browserHost.environment()`); const cli = await promisify(execFile)(process.execPath, [env.NAND_BROWSER_CLI, 'snapshot', '--connection', env.NAND_BROWSER_CONTEXT, '--page', page], { env: { ...process.env, ...env } }); assert.equal(JSON.parse(cli.stdout).ok, true);
	rows.push({ name: 'external-node-cli-same-page', passed: true });
	// Open the real markup menu, draw with native pointer input, undo/redo and export.
	await c.evaluate(`(()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${page}');p.webview.closest('.nand-browser-panel').querySelector('button[aria-label="More actions"]').click()})()`);
	await until(()=>c.evaluate(`(()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${page}');const item=[...p.webview.doc.querySelectorAll('.menu-item')].find(e=>e.textContent.includes('Annotate screenshot'));if(!item)return false;item.click();return true})()`),'markup menu');
	await until(()=>c.evaluate(`(()=>{const canvas=app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closest('.nand-browser-panel').querySelector('.nand-browser-markup canvas');return canvas?.dataset.ready==='true'&&canvas.width>300&&canvas.height>150&&canvas.getContext('2d').getImageData(0,0,1,1).data[3]>0})()`),'markup image pixels loaded');
	await c.evaluate(`(()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${page}'),canvas=p.webview.closest('.nand-browser-panel').querySelector('.nand-browser-markup canvas'),r=canvas.getBoundingClientRect(),host=p.guest.hostWebContents,z=host.getZoomFactor();window.nandBrowserMarkupBefore=canvas.toDataURL();for(const [type,x,y] of [['mouseDown',r.x+35,r.y+35],['mouseMove',r.x+140,r.y+100],['mouseUp',r.x+140,r.y+100]])host.sendInputEvent({type,x:Math.round(x*z),y:Math.round(y*z),button:'left',clickCount:1})})()`);
	await until(()=>c.evaluate(`(()=>{const root=app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closest('.nand-browser-panel'),undo=[...root.querySelectorAll('button')].find(b=>b.textContent==='Undo');return undo&&!undo.disabled})()`),'markup stroke');
	const markup = await c.evaluate(`(()=>{const root=app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closest('.nand-browser-panel');return root.querySelector('.nand-browser-markup canvas').toDataURL()})()`);await saveImage('browser-markup',markup);
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closest('.nand-browser-panel').querySelector('.nand-browser-markup canvas').toDataURL()!==window.nandBrowserMarkupBefore`),true);
	await c.evaluate(`(()=>{const root=app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closest('.nand-browser-panel');[...root.querySelectorAll('button')].find(b=>b.textContent==='Undo').click()})()`);await delay(100);
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closest('.nand-browser-panel').querySelector('.nand-browser-markup canvas').toDataURL()===window.nandBrowserMarkupBefore`),true);
	await c.evaluate(`(()=>{const root=app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closest('.nand-browser-panel');[...root.querySelectorAll('button')].find(b=>b.textContent==='Redo').click()})()`);await delay(100);
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closest('.nand-browser-panel').querySelector('.nand-browser-markup canvas').toDataURL()`),markup);
	await c.evaluate(`(()=>{const root=app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closest('.nand-browser-panel');[...root.querySelectorAll('.nand-browser-markup button')].find(b=>b.textContent==='Copy image').click()})()`);
	await until(()=>c.evaluate(`!!app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closest('.nand-browser-panel').querySelector('.nand-browser-grab')`),'annotated attachment preview');
	await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closest('.nand-browser-panel').querySelector('.nand-browser-grab button[aria-label="Close"]').click()`);
	await until(()=>c.evaluate(`!app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closest('.nand-browser-panel').querySelector('.nand-browser-grab')`),'preview closed');await delay(100);
	rows.push({name:'markup-visible-draw-undo-redo-copy-preview',passed:true});
	const hostScreenshot = await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${page}');return (await p.guest.hostWebContents.capturePage()).toDataURL()})()`); await saveImage('browser-in-obsidian', hostScreenshot);
	// Downloads still use the native save dialog. Select the test path before it is shown.
	const downloadPath = path.join(dir, 'download.txt');
	const downloadHelper = path.join(dir, 'download-helper.cjs');
	await fs.writeFile(downloadHelper, `exports.next=(id,path)=>{const w=require('electron').webContents.fromId(id);const fn=(_e,item,owner)=>{if(owner.id===id){item.setSavePath(path);w.session.removeListener('will-download',fn)}};w.session.on('will-download',fn)};`);
	await c.evaluate(`(()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${page}');window.require('@electron/remote').require(${JSON.stringify(downloadHelper)}).next(p.guest.id,${JSON.stringify(downloadPath)});})()`);
	await pageEval(page, 'document.querySelector("a").click()');
	await until(() => c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${page}').downloads.some(d=>d.state==='completed')`), 'download complete');assert.equal(await fs.readFile(downloadPath,'utf8'),'NAND browser download');
	rows.push({ name: 'download-progress-complete', passed: true });
	await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.openDevTools()`);await delay(300);
	// Depending on Electron, DevTools either detaches the lease or coexists with it.
	const debuggerState = await c.evaluate(`(()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${page}');return {lost:p.automation.lost,attached:p.guest.debugger.isAttached(),alive:!p.guest.isDestroyed()}})()`);assert.equal(debuggerState.alive,true);
	if(debuggerState.lost)await assert.rejects(call('snapshot',{page}),/browser_debugger_unavailable/);
	await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${page}').webview.closeDevTools()`);
	rows.push({ name: 'devtools-preserves-browsing', passed: true, ...debuggerState });
	// Real native split, duplicate, popout and restore: moving may rebuild only the guest.
	await call('scroll',{page,direction:'down',amount:250});await delay(1200);
	const beforeMove = await c.evaluate(`(()=>{const b=app.plugins.plugins.nand.browserHost,l=app.workspace.getLeavesOfType('nand-browser-view').find(l=>l.view.state.id==='${page}');window.nandBrowserMoveLeaf=l;return {state:l.view.getState(),guest:b.pages.get('${page}').guest.id}})()`);
	await c.evaluate(`app.workspace.moveLeafToPopout(window.nandBrowserMoveLeaf);true`);
	await until(()=>c.evaluate(`(()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${page}');return !!p?.guest&&!p.guest.isDestroyed()&&p.guest.id!==${beforeMove.guest}&&!p.state.loading&&p.state.url.includes('/board')&&p.webview.win!==window})()`),'popout browser rebuilt');
	assert.equal(await pageEval(page,'location.pathname'),'/board');assert.ok((await pageEval(page,'document.cookie')).includes('login=success'));
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${page}').state.zoom`),beforeMove.state.zoom);
	await until(()=>pageEval(page,'scrollY>0'),'scroll restored in popout');
	const popoutPng = await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${page}');return (await p.guest.hostWebContents.capturePage()).toDataURL()})()`);await saveImage('browser-popout',popoutPng);
	const duplicate = await c.evaluate(`(async()=>{const leaf=app.workspace.getLeaf('split','vertical');await leaf.setViewState({type:'nand-browser-view',active:true,state:${JSON.stringify(beforeMove.state)}});await app.workspace.revealLeaf(leaf);return leaf.view.state.id})()`);owned.push(duplicate);assert.notEqual(duplicate,page);
	const restoring = await create(); const restoredGuest = await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${restoring}').guest.id`);
	await c.evaluate(`(async()=>{const leaf=app.workspace.getLeavesOfType('nand-browser-view').find(l=>l.view.state.id==='${restoring}'),state=leaf.view.getState();await leaf.setViewState({type:'empty'});await leaf.setViewState({type:'nand-browser-view',active:true,state});await app.workspace.revealLeaf(leaf)})()`);
	await until(()=>c.evaluate(`!!app.plugins.plugins.nand.browserHost.pages.get('${restoring}')?.guest`),'workspace state restored');
	assert.notEqual(await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${restoring}').guest.id`),restoredGuest);
	assert.ok((await pageEval(restoring,'document.cookie')).includes('login=success'));
	rows.push({name:'split-duplicate-popout-state-restore',passed:true});
	for (const id of owned.splice(0)) { try { await call('tab.close', { page: id }); } catch { /* Already transferred. */ } }
	for (let i = 0; i < 5; i++) { const id = await create(); await snapshot(id); await call('tab.close', { page: id }); }
	await until(() => c.evaluate(`window.require('@electron/remote').webContents.getAllWebContents().filter(w=>w.getType()==='webview').length===${baseline}`), 'guest baseline restored');
	const last = await create(); const leafCount = await c.evaluate(`app.workspace.getLeavesOfType('nand-browser-view').length`);
	await c.evaluate(`app.plugins.plugins.nand.browserHost.setEnabled(false)`);await delay(200);
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.size`),0);assert.equal(await c.evaluate(`app.workspace.getLeavesOfType('nand-browser-view').length`),leafCount);
	assert.equal(await fs.access(env.NAND_BROWSER_CONTEXT).then(()=>true,()=>false),false);
	await c.evaluate(`app.plugins.plugins.nand.browserHost.setEnabled(true)`);await until(()=>c.evaluate(`!!app.plugins.plugins.nand.browserHost.pages.get('${last}')?.guest`),'module enabled');
	rows.push({ name: 'repeated-close-disable-reenable-cleanup', passed: true, baseline });
	const failure = await create('http://127.0.0.1:1/unreachable');
	await until(()=>c.evaluate(`!!app.plugins.plugins.nand.browserHost.pages.get('${failure}').state.error`),'main-frame load error');
	await call('goto',{page:failure,url:base+'/board'});await call('wait',{page:failure,load:'load'});assert.equal(await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${failure}').state.error`),null);
	const navigation=call('goto',{page:failure,url:base+'/hang'}).catch(error=>String(error));await delay(200);await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${failure}').stop()`);await navigation;
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${failure}').state.loading`),false);
	await assert.rejects(call('goto',{page:failure,url:base+'/board'}), /browser_page_closed/);
	await c.evaluate(`(()=>{const panel=document.querySelector('[data-page-id="${failure}"]'),input=panel.querySelector('.nand-browser-address');input.value=${JSON.stringify(base+'/board')};input.dispatchEvent(new input.win.Event('input',{bubbles:true}));})()`);await delay(50);
	await c.evaluate(`(()=>{const input=document.querySelector('[data-page-id="${failure}"] .nand-browser-address');input.form.requestSubmit();})()`);
	await until(()=>c.evaluate(`(()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${failure}');return p?.guest&&!p.disposed&&!p.state.loading&&p.state.url.includes('/board')})()`),'address recreates retired guest');
	const beforeCrash=await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${failure}').guest.id`);
	await c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${failure}').guest.forcefullyCrashRenderer();true`);
	await until(()=>c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${failure}').state.error==='browser_guest_crashed'`),'renderer crash state');
	await c.evaluate(`(()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${failure}');[...document.querySelector('[data-page-id="${failure}"]').querySelectorAll('button')].find(b=>b.textContent==='Retry').click()})()`);
	await until(()=>c.evaluate(`(()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${failure}');return p?.guest&&p.guest.id!==${beforeCrash}&&!p.state.loading&&p.state.url.includes('/board')&&!p.state.error})()`),'crash retry rebuilt');
	const waiting=call('wait',{page:failure,text:'NAND_NOT_PRESENT',timeout:60000}).catch(error=>String(error));await delay(150);await call('tab.close',{page:failure});assert.match(await waiting,/browser_page_closed/);
	rows.push({name:'load-failure-stop-crash-retry-cancel-queue',passed:true});
	await fs.writeFile(path.join(dir,'results.json'),JSON.stringify({runtime,rows},null,2));console.log(JSON.stringify({passed:rows.length,rows},null,2));
} catch(error) { await fs.mkdir(dir,{recursive:true});const state=await c.evaluate(`({pages:[...app.plugins.plugins.nand.browserHost.pages.values()].map(p=>({state:p.state,design:!!p.automation.designHandler})),grab:window.nandBrowserGrab})`).catch(()=>null);await fs.writeFile(path.join(dir,'failure.json'),JSON.stringify({rows,error:String(error),state},null,2));throw error; }
finally { for(const id of owned){try{await call('tab.close',{page:id});}catch{}} c.close();fixture.closeAllConnections();fixture.close(); }
