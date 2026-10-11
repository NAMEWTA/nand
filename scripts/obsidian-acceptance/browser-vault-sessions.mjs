import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const server = createServer((req, res) => {
 if (req.url === '/download') { res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="vault-proof.txt"' }); res.end('vault-download-bytes'); return; }
 res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
 res.end('<title>Vault browser fixture</title><h1>Vault browser fixture</h1><p>Local session acceptance</p>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`, p = 'app.plugins.plugins.nand', rows = [], legacyId = '11223344-5566-4777-8888-1234567890ab';
const surfaces = "app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces())";
let runtime, c;
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const until = async expression => { const end = Date.now() + 30000; let lastError; while (Date.now() < end) { try { if (await c.evaluate(expression)) return; } catch (error) { lastError = error; } await delay(80); } throw Error('Timed out: ' + expression + (lastError ? String(lastError) : '')); };
const bind = async () => { await c.evaluate(`window.bo=${p}.services.peek({owner:'browser',id:'open'});window.bp=${p}.services.peek({owner:'browser',id:'profiles'});true`); };
const open = async () => c.evaluate(`bo.open({url:${JSON.stringify(url)}})`);
const guest = id => `document.querySelector('[data-page-id="${id}"] webview')`;
const native = id => `require('@electron/remote').webContents.fromId(${guest(id)}.getWebContentsId())`;
const script = (id, source) => c.evaluate(`${guest(id)}.executeJavaScript(${JSON.stringify(source)},true)`);
const moveAfterDownloadCloses = async (from, to) => {
 const deadline=Date.now()+5000;
 for (;;) { try { await fs.rename(from,to); return; } catch(error) { if(!['EPERM','EBUSY'].includes(error.code)||Date.now()>deadline)throw error; await delay(80); } }
};
try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9445, settings: { version: 1, namespaces: { app: { language: 'zh', introSeen: true, modules: Object.fromEntries(['home','agent','browser','news','archives','automations','notifications','icons','comments','sync'].map(id => [id,false])) } } } }); c = runtime.connection;
 const identityPath = path.join(runtime.vault, '.nand/config/identity.json'), identity = JSON.parse(await fs.readFile(identityPath, 'utf8')), device = Object.keys(identity.devices)[0];
 identity.devices[device].legacyBrowserVaultId = legacyId; await fs.writeFile(identityPath, JSON.stringify(identity));
 const legacyPath = await c.evaluate(`(async()=>{const e=document.createElement('webview');e.partition='persist:nand-browser-${legacyId}';const ready=new Promise(resolve=>e.addEventListener('dom-ready',resolve,{once:true}));e.src=${JSON.stringify(url)};document.body.append(e);await ready;await e.executeJavaScript("document.cookie='account=legacy;path=/;max-age=86400';localStorage.account='legacy';true");const s=require('@electron/remote').webContents.fromId(e.getWebContentsId()).session;await s.cookies.flushStore();const directory=s.storagePath;e.remove();return directory})()`);
 const oldRuntime = path.join(path.dirname(path.dirname(legacyPath)),'nand-browser',legacyId);
 await fs.mkdir(path.join(oldRuntime,'artifacts'),{recursive:true}); await fs.writeFile(path.join(oldRuntime,'artifacts','11223344-5566-4777-8888-1234567890ac.txt'),'retained legacy context');
 await runtime.restart(); c = runtime.connection;
 await c.evaluate(`${p}.setModuleEnabled('browser',true)`); await bind();
 const profiles = [];
 for (const phase of ['restart','published','complete']) {
  const profile = await c.evaluate(`bp.create(${JSON.stringify(phase)})`);
  const source = await c.evaluate(`(async()=>{const e=document.createElement('webview');e.partition='persist:nand-browser-${legacyId}-profile-${profile.id}';const ready=new Promise(resolve=>e.addEventListener('dom-ready',resolve,{once:true}));e.src=${JSON.stringify(url)};document.body.append(e);await ready;await e.executeJavaScript("document.cookie='original=owned;path=/;max-age=86400';localStorage.original='owned';true");const s=require('@electron/remote').webContents.fromId(e.getWebContentsId()).session;await s.cookies.flushStore();const directory=s.storagePath;e.remove();return directory})()`);
  profiles.push({id:profile.id,phase,source});
  const failure = await c.evaluate(phase === 'restart' ? `bp.remove('${profile.id}',[]).then(()=>'',e=>e.message)` : `bo.open({url:${JSON.stringify(url)},profileId:'${profile.id}'}).then(()=>'',e=>e.message)`);
  check(`legacy-profile-${phase}-requires-cold-restart`, /browser_session_restart|重新启动/.test(failure));
 }
 const first = await c.evaluate(`bo.open({url:${JSON.stringify(url)}}).then(()=>'',e=>e.message)`);
 check('legacy-session-requires-full-restart', first.includes('关闭所有 Obsidian') && first.includes('重新启动'), first);
 await c.evaluate(`${p}.setModuleEnabled('browser',false)`); await c.evaluate(`${p}.setModuleEnabled('browser',true)`); await bind();
 const reload = await c.evaluate(`bo.open({url:${JSON.stringify(url)}}).then(()=>'',e=>e.message)`);
 check('module-reload-does-not-bypass-cold-migration', reload.includes('关闭所有 Obsidian') && reload.includes('重新启动'));
 await runtime.restart(); c = runtime.connection; await bind();
 for (const profile of profiles) {
  if (profile.phase === 'restart') {
   await c.evaluate(`bp.remove('${profile.id}',bp.affectedPages('${profile.id}').map(p=>p.id))`);
   check('delete-before-migration-retries-after-cold-restart', await fs.stat(profile.source).then(()=>false,error=>error.code==='ENOENT') && await c.evaluate(`!bp.list().some(p=>p.id==='${profile.id}')`));
  } else await c.evaluate(`bo.open({url:${JSON.stringify(url)},profileId:'${profile.id}'})`);
 }
 const id = await open(), directory = await c.evaluate(`${native(id)}.session.storagePath`);
 check('cold-copy-opens-only-vault-session', directory === path.join(runtime.vault, '.nand/browser', device, 'profiles/default/session'), directory);
 check('legacy-cookie-and-site-data-survive-copy', await script(id, "document.cookie==='account=legacy'&&localStorage.account==='legacy'"));
 check('old-bridge-artifacts-retained-in-vault', await fs.readFile(path.join(runtime.vault,'.nand/browser',device,'legacy-runtime/files/artifacts/11223344-5566-4777-8888-1234567890ac.txt'),'utf8') === 'retained legacy context');
 check('old-bridge-source-cleaned-after-verification', await fs.stat(oldRuntime).then(()=>false,error=>error.code==='ENOENT'));
 check('legacy-original-retained-until-next-boot', (await fs.stat(legacyPath)).isDirectory());
 await script(id, "document.cookie='account=current;path=/;max-age=86400';localStorage.account='current';true");
 await c.evaluate(`${native(id)}.session.cookies.flushStore()`);
 await script(id, `window.open(${JSON.stringify(url + '/oauth')},'auth','width=500,height=500');true`);
 await until(`require('@electron/remote').webContents.getAllWebContents().some(w=>w.getURL()===${JSON.stringify(url + '/oauth')})`);
 const popup = await c.evaluate(`require('@electron/remote').webContents.getAllWebContents().find(w=>w.getURL()===${JSON.stringify(url + '/oauth')}).id`);
 check('native-login-popup-shares-vault-session', await c.evaluate(`require('@electron/remote').webContents.fromId(${popup}).session.storagePath`) === directory);
 check('native-popup-cookie-is-shared', await c.evaluate(`require('@electron/remote').webContents.fromId(${popup}).executeJavaScript("document.cookie==='account=current'")`));
 await script(id, `location.href=${JSON.stringify(url + '/download')};true`);
 const downloadDir = path.join(runtime.vault, '.nand/browser', device, 'profiles/default/downloads'); let download;
 for (let i = 0; i < 100 && !download; i++) { download = (await fs.readdir(downloadDir)).find(name => name.endsWith('-vault-proof.txt')); if (!download) await delay(100); }
 check('download-has-vault-destination', !!download);
 check('download-bytes-are-complete', await fs.readFile(path.join(downloadDir, download), 'utf8') === 'vault-download-bytes');
	await until(`!!document.querySelector('[data-page-id="${id}"] .nand-browser-downloads button[aria-label="打开文件"]:not([disabled])')`);
 const outside = path.join(runtime.root ?? path.dirname(runtime.vault),'outside-download'); await fs.mkdir(outside);
 const parked = downloadDir + '-parked'; await moveAfterDownloadCloses(downloadDir, parked); await fs.symlink(outside, downloadDir, 'junction');
 await script(id, `location.href=${JSON.stringify(url + '/download')};true`);
 await until(`document.querySelector('[data-page-id="${id}"]')?.textContent.includes('下载失败')`);
 check('unsafe-download-visible-and-no-outside-file', (await fs.readdir(outside)).length === 0);
 await runtime.shot('download-error'); await fs.rmdir(downloadDir); await fs.rename(parked, downloadDir);
 const published = profiles.find(profile=>profile.phase==='published');
 const publishedDownloads = path.join(runtime.vault,'.nand/browser',device,'profiles',published.id,'downloads');
 await fs.writeFile(path.join(publishedDownloads,'saved-material.txt'),'keep saved material');
 await c.evaluate(`bp.remove('${published.id}',bp.affectedPages('${published.id}').map(p=>p.id))`);
 check('published-profile-delete-clears-old-source-and-backup', await fs.stat(published.source).then(()=>false,error=>error.code==='ENOENT') && await fs.stat(path.join(publishedDownloads,'../legacy-original')).then(()=>false,error=>error.code==='ENOENT'));
 check('profile-delete-retains-saved-downloads', await fs.readFile(path.join(publishedDownloads,'saved-material.txt'),'utf8') === 'keep saved material');
 const artifacts = await c.evaluate(`(async()=>{window.bh=${surfaces}.find(s=>s.state?.id===${JSON.stringify(id)}).host;return bh.saveImage('data:image/png;base64,aGVsbG8=','context')})()`);
 const runtimeRoot = path.join(runtime.vault,'.nand/browser',device,'runtime'), run = (await fs.readdir(runtimeRoot)).find(name => /^[a-f\d-]{36}$/.test(name));
 assert.ok(run); const bridgePaths = { artifacts, context: path.join(runtimeRoot,run,'connection.json'), cli: path.join(runtimeRoot,run,'nand-browser.cjs') };
 check('bridge-and-artifacts-use-vault-device-root', [bridgePaths.context,bridgePaths.cli,...bridgePaths.artifacts].every(file => file.startsWith(path.join(runtime.vault,'.nand/browser',device)+path.sep)), bridgePaths);
 await runtime.shot('vault-browser-and-download');
 await runtime.restart(); c = runtime.connection; await bind(); const restored = await open();
 const complete = profiles.find(profile=>profile.phase==='complete'); await c.evaluate(`bo.open({url:${JSON.stringify(url)},profileId:'${complete.id}'})`);
 const completeRoot = path.join(runtime.vault,'.nand/browser',device,'profiles',complete.id);
 check('profile-cleanup-reached-complete-phase', JSON.parse(await fs.readFile(path.join(completeRoot,'migration.json'),'utf8')).phase === 'complete');
 await c.evaluate(`bp.remove('${complete.id}',bp.affectedPages('${complete.id}').map(p=>p.id))`);
 check('complete-profile-delete-clears-legacy-recovery', await fs.stat(path.join(completeRoot,'legacy-original')).then(()=>false,error=>error.code==='ENOENT'));
 check('migrated-session-retains-new-data-after-restart', await script(restored, "document.cookie==='account=current'&&localStorage.account==='current'"));
 check('legacy-source-cleaned-only-after-validation', await fs.stat(legacyPath).then(() => false, error => error.code === 'ENOENT'));
 check('legacy-source-preserved-inside-vault', (await fs.stat(path.join(runtime.vault,'.nand/browser',device,'profiles/default/legacy-original'))).isDirectory());
 check('closed-runtime-removes-connection', await fs.stat(bridgePaths.context).then(() => false, error => error.code === 'ENOENT'));
 check('published-artifacts-remain-in-vault', await fs.readFile(bridgePaths.artifacts.find(file=>file.endsWith('.txt')), 'utf8') === 'context');
 await c.evaluate(`${p}.setModuleEnabled('home',true)`);
 await c.evaluate(`${p}.openWorkbench({feature:'dashboard'},window)`);
 await until(`${surfaces}.some(s=>s.sync?.getData())`);
 await c.evaluate(`window.board=${surfaces}.find(s=>s.sync?.getData());board.sync.addColumn('Vault web','web')`);
 await c.evaluate(`board.sync.updateWebConfig('Vault web',{url:${JSON.stringify(url)},zoom:0.9})`);
 await until(`document.querySelector('.dashboard-web-frame')?.getURL?.()===${JSON.stringify(url + '/')}`);
 const homePath = await c.evaluate(`require('@electron/remote').webContents.fromId(document.querySelector('.dashboard-web-frame').getWebContentsId()).session.storagePath`);
 check('home-webview-has-separate-vault-session', homePath === path.join(runtime.vault,'.nand/browser',device,'profiles/home-web/session'));
 check('home-webview-does-not-inherit-browser-cookie', await c.evaluate(`document.querySelector('.dashboard-web-frame').executeJavaScript('document.cookie')`) === '');
 check('music-cookie-store-is-in-vault', (await fs.stat(path.join(runtime.vault,'.nand/browser',device,'profiles/home-music/session'))).isDirectory());
 check('no-host-iframe-fallback', await c.evaluate(`document.querySelectorAll('.dashboard-web-content iframe').length===0`));
 await c.evaluate(`document.querySelector('.dashboard-web-frame').scrollIntoView({block:'center'});true`); await delay(150);
 await runtime.shot('home-owned-webview');
 await c.evaluate(`board.sync.addColumn('Other web','web');board.sync.updateWebConfig('Other web',{url:${JSON.stringify(url)},zoom:0.9})`);
 await until(`document.querySelectorAll('.dashboard-web-frame').length===2&&[...document.querySelectorAll('.dashboard-web-frame')].every(e=>e.getURL?.()===${JSON.stringify(url + '/')})`);
 const unaffectedGuest = await c.evaluate(`document.querySelector('[data-column="Other web"] webview').getWebContentsId()`);
 const homeDownloads = path.join(homePath,'../../home-web/downloads'), homeParked = homeDownloads + '-parked';
 await fs.rename(homeDownloads,homeParked); await fs.symlink(outside,homeDownloads,'junction');
 await c.evaluate(`document.querySelector('.dashboard-web-frame').executeJavaScript(${JSON.stringify('location.href='+JSON.stringify(url+'/download')+';true')})`);
 await until(`document.querySelector('.dashboard-web-fallback')?.textContent.includes('下载失败')`);
 check('home-download-error-visible-and-no-outside-file',(await fs.readdir(outside)).length===0);
 check('download-failure-keeps-other-home-webview-alive', await c.evaluate(`document.querySelector('[data-column="Other web"] webview')?.getWebContentsId()===${unaffectedGuest}&&!require('@electron/remote').webContents.fromId(${unaffectedGuest}).isDestroyed()`));
 await runtime.shot('home-download-error'); await fs.rmdir(homeDownloads); await fs.rename(homeParked,homeDownloads);
 await c.evaluate(`document.querySelector('.dashboard-web-fallback-btn').click();true`);
 await until(`document.querySelector('.dashboard-web-frame')?.getURL?.()===${JSON.stringify(url + '/')}`);
 check('home-download-error-can-retry',true);
 const musicPath = path.join(runtime.vault,'.nand/browser',device,'profiles/home-music/session');
 const intercept = `(()=>{const require=process.getBuiltinModule('module').createRequire(process.execPath);return directory=>require('electron').session.fromPath(directory).protocol.handle('https',()=>new Response('<title>Local music login fixture</title><h1>Local music login fixture</h1>',{headers:{'Content-Type':'text/html'}}))})()`;
 await c.evaluate(`require('@electron/remote').require('node:vm').runInThisContext(${JSON.stringify(intercept)})(${JSON.stringify(musicPath)})`);
 await c.evaluate(`${p}.openWorkbench({feature:'settings',section:'dashboard'},window)`);
 const loginButton = `[...document.querySelectorAll('button')].find(e=>e.textContent==='手机号 / 网易云登录')`;
 await until(`!!${loginButton}`); await c.evaluate(`${loginButton}.scrollIntoView({block:'center'});${loginButton}.click();true`);
 await until(`require('@electron/remote').webContents.getAllWebContents().some(w=>w.getURL().startsWith('https://music.163.com'))`);
 const login = await c.evaluate(`(()=>{const w=require('@electron/remote').webContents.getAllWebContents().find(w=>w.getURL().startsWith('https://music.163.com'));return{id:w.id,path:w.session.storagePath,node:w.getLastWebPreferences().nodeIntegration}})()`);
 check('native-music-login-window-uses-vault-session', login.path === musicPath && login.node === false);
 check('music-login-test-used-local-intercept', await c.evaluate(`require('@electron/remote').webContents.fromId(${login.id}).executeJavaScript('document.title')`) === 'Local music login fixture');
 await c.evaluate(`require('@electron/remote').webContents.fromId(${login.id}).close();true`); await delay(150);
 await c.evaluate(`require('@electron/remote').session.fromPath(${JSON.stringify(musicPath)}).protocol.unhandle('https');true`);
 check('no-host-errors', await c.evaluate('nandAcceptanceErrors.length') === 0, await c.evaluate('nandAcceptanceErrors'));
 await fs.writeFile(path.join(runtime.evidence,'result.json'),JSON.stringify({rows},null,2));
} catch (error) {
 if (runtime) await fs.writeFile(path.join(runtime.evidence,'partial.json'),JSON.stringify({rows,error:String(error),body:await c.evaluate('document.body.innerText').catch(()=>''),errors:await c.evaluate('nandAcceptanceErrors').catch(()=>[])},null,2));
 throw error;
} finally {
 if (runtime) { console.log(JSON.stringify({evidence:runtime.evidence,checks:rows.length})); await runtime.stop(); }
 server.closeAllConnections(); server.close();
}
