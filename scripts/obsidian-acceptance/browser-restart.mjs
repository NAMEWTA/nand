// Owns only the explicitly marked acceptance profile; never restarts a daily instance.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { connect } from './cdp.mjs';
assert.equal(process.env.NAND_ALLOW_BROWSER_E2E,'1');assert.ok(process.env.NAND_WINDOWS_E2E_NONCE);
const root=path.resolve('scripts/tmp/e2e-2026-09-30'),profile=path.join(root,'profile'),vault=path.join(root,'vault');
const evidence=process.env.NAND_ACCEPTANCE_DIR;assert.ok(evidence&&path.isAbsolute(evidence));
let c=await connect();const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>NAND restart fixture</title><h1>Restart restored</h1><div style="height:2000px"></div>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/restore`;
let page;
try{
	const actual=await c.evaluate(`(async()=>{const r=window.require('@electron/remote');return {profile:r.app.getPath('userData'),exe:r.app.getPath('exe'),vault:app.vault.adapter.basePath,marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json'))}})()`);
	assert.equal(path.resolve(actual.profile),profile);assert.equal(path.resolve(actual.vault),vault);assert.equal(actual.marker.kind,'nand-windows-e2e');assert.equal(actual.marker.nonce,process.env.NAND_WINDOWS_E2E_NONCE);assert.equal(path.resolve(actual.marker.vaultPath),vault);
	page=await c.evaluate(`app.plugins.plugins.nand.browserHost.open({url:${JSON.stringify(url)}})`);
	await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${page}');await p.guest.executeJavaScript("document.cookie='restart=kept; max-age=600; path=/';scrollTo(0,450)");p.zoom(1.25)})()`);await delay(1500);
	const before=await c.evaluate(`app.workspace.getLeavesOfType('nand-browser-view').find(l=>l.view.state.id==='${page}').getViewState()`);
	await c.evaluate(`app.workspace.requestSaveLayout();true`);await delay(2000);
	await c.evaluate(`setTimeout(()=>window.require('@electron/remote').app.quit(),200);true`);c.close();await delay(1200);
	const quote=value=>"'"+value.replace(/'/g,"''")+"'";
	await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Start-Process -FilePath ${quote(actual.exe)} -ArgumentList @(${quote('--user-data-dir="'+profile+'"')},'--remote-debugging-address=127.0.0.1','--remote-debugging-port=9237') -WindowStyle Hidden`],{windowsHide:true});
	let attached=false;for(let i=0;i<80;i++){try{c=await connect();if(await c.evaluate('!!window.app?.plugins?.plugins?.nand?.browserHost')){attached=true;break;}c.close();}catch{}await delay(250);}assert.ok(attached,'Restarted NAND instance');
	assert.equal(await c.evaluate(`app.vault.adapter.basePath`),vault);
	const tabs=await c.evaluate(`app.plugins.plugins.nand.browserHost.execute('tab.list',{})`);assert.ok(tabs.tabs.some(tab=>tab.id===page&&tab.url===url));
	await c.evaluate(`app.plugins.plugins.nand.browserHost.activate('${page}')`);
	await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${page}');await p.ready;await p.initialLoad})()`);
	const after=await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand.browserHost.pages.get('${page}');return {state:p.state,content:await p.guest.executeJavaScript('({cookie:document.cookie,scroll:scrollY,title:document.title})')}})()`);
	assert.equal(after.state.zoom,1.25);assert.ok(after.content.cookie.includes('restart=kept'));assert.ok(after.content.scroll>0);assert.equal(after.content.title,'NAND restart fixture');
	await fs.mkdir(evidence,{recursive:true});await fs.writeFile(path.join(evidence,'restart.json'),JSON.stringify({passed:true,before,after},null,2));console.log('Browser restart: native workspace, Cookie, zoom and scroll restored.');
}finally{if(page){try{await c.evaluate(`app.plugins.plugins.nand.browserHost.execute('tab.close',{page:'${page}'})`);}catch{}}c.close();server.closeAllConnections();server.close();}
