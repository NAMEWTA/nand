// Creates a NEW disposable fixture only; never adopts, marks or deletes a daily Vault/profile.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { connect } from './cdp.mjs';
assert.equal(process.env.NAND_ALLOW_FRESH_ISSUE_FIXTURE, '1');
const selected = process.env.NAND_ACCEPTANCE_CASE || 'comments';
assert.ok(['all', 'content', 'layout', 'conflict', 'comments'].includes(selected), 'Unknown acceptance case');
const root = process.env.NAND_FRESH_FIXTURE_ROOT, executable = process.env.NAND_OBSIDIAN_EXECUTABLE;
assert.ok(root && path.isAbsolute(root));assert.ok(executable && path.isAbsolute(executable));
assert.notEqual(path.parse(root).root,root);
await fs.mkdir(root);
const vault=path.join(root,'vault'),profile=path.join(root,'profile'),evidence=path.join(root,'evidence');
const nonce=randomBytes(16).toString('hex'),manifest=JSON.parse(await fs.readFile('manifest.json','utf8'));
for(const p of [vault,profile,evidence,path.join(root,'home'),path.join(root,'config'),path.join(root,'runtime'),path.join(vault,'.obsidian','plugins',manifest.id),path.join(vault,'.nand','config')]) await fs.mkdir(p,{recursive:true,mode:0o700});
for(const file of ['main.js','styles.css','manifest.json'])await fs.copyFile(file,path.join(vault,'.obsidian','plugins',manifest.id,file));
const mainSha256=createHash('sha256').update(await fs.readFile('main.js')).digest('hex');
await fs.writeFile(path.join(vault,'.nand-e2e-isolated.json'),JSON.stringify({kind:'nand-windows-e2e',nonce,vaultPath:vault}));
await fs.writeFile(path.join(vault,'.obsidian','community-plugins.json'),JSON.stringify([manifest.id]));
await fs.writeFile(path.join(vault,'.obsidian','app.json'),JSON.stringify({livePreview:true}));
// The vault settings file in the store's namespaced layout: Chinese UI, intro seen, the agent, icons and sync modules off,
// music and weather widgets off (the file's presence also keeps the first-run sample board from being seeded).
await fs.writeFile(path.join(vault,'.nand','config','settings.json'),JSON.stringify({version:1,namespaces:{
  app:{language:'zh',introSeen:true,modules:{home:true,comments:true,archives:true,browser:true,automations:true,notifications:true,agent:false,icons:false,sync:false}},
  home:{widgetMusicEnabled:false,widgetWeatherEnabled:false},
}}));
await fs.writeFile(path.join(vault,'Welcome.md'),'Owned acceptance fixture.\n');
await fs.writeFile(path.join(profile,'obsidian.json'),JSON.stringify({vaults:{abcdef1234567890:{path:vault,ts:Date.now(),open:true}}}));
const env={...process.env,HOME:path.join(root,'home'),XDG_CONFIG_HOME:path.join(root,'config'),XDG_RUNTIME_DIR:path.join(root,'runtime'),NAND_ALLOW_BROWSER_E2E:'1',NAND_ALLOW_WINDOWS_E2E:'1',NAND_WINDOWS_E2E_NONCE:nonce,NAND_EXPECT_MAIN_SHA:mainSha256,NAND_ACCEPTANCE_VAULT:vault,NAND_ACCEPTANCE_PROFILE:profile,NAND_CDP_URL:'http://127.0.0.1:9237'};
let app,stopped,connection;const rows=[];
async function launch(){
  const log=openSync(path.join(evidence,'application.log'),'a');
  app=spawn(executable,['--no-sandbox','--disable-gpu','--user-data-dir='+profile,'--remote-debugging-port=9237'],{env,stdio:['ignore',log,log],windowsHide:false});closeSync(log);
  stopped=once(app,'exit');const deadline=Date.now()+90000;
  while(Date.now()<deadline){
    if((app.exitCode!==null||app.signalCode!==null))throw Error('Owned Obsidian exited during startup: '+app.exitCode);
    try{connection=await connect();break;}catch{await delay(250);}
  }
  assert.ok(connection,'Owned runtime did not expose its CDP target');
  let ready=false;
  while(Date.now()<deadline){
    try { ready=await connection.evaluate(`typeof app !== 'undefined' && !!app.vault?.adapter && !!app.workspace`); } catch { ready=false; }
    if(ready)break;
    if((app.exitCode!==null||app.signalCode!==null))throw Error('Owned Obsidian exited before initializing');
    await delay(100);
  }
  assert.ok(ready,'Native app object did not initialize');
  const state=await connection.evaluate(`({vault:app.vault.adapter.basePath,profile:require('@electron/remote').app.getPath('userData'),platform:process.platform,ua:navigator.userAgent,version:require('@electron/remote').app.getVersion()})`);
  rows.push({pid:app.pid,...state,mainSha256});
  assert.equal(path.resolve(state.vault),path.resolve(vault));assert.equal(path.resolve(state.profile),path.resolve(profile));assert.equal(state.platform,process.platform);assert.equal(state.version,'1.13.7');
  while(Date.now()<deadline){
    if(await connection.evaluate(`(app.plugins.plugins.nand?.moduleState?.('comments')==='active')`))break;
    await connection.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Trust author and enable plugins');b?.click()})()`);
    await delay(100);
  }
  if (!await connection.evaluate(`(app.plugins.plugins.nand?.moduleState?.('comments')==='active')`)) {
    await fs.writeFile(path.join(evidence,'startup-diagnostic.json'), JSON.stringify(await connection.evaluate(`({plugins:Object.keys(app.plugins.plugins),enabled:[...app.plugins.enabledPlugins],plugin:app.plugins.plugins.nand?{keys:Object.keys(app.plugins.plugins.nand),modules:app.plugins.plugins.nand.appSettings?.get?.().modules}:null,body:document.body.innerText})`),null,2));
    throw Error('Plugin failed to initialize');
  }
}
async function stop(){
  if(!app||(app.exitCode!==null||app.signalCode!==null))return;
  if(connection){await connection.evaluate(`setTimeout(()=>require('@electron/remote').app.quit(),50);true`);connection.close();connection=null;}
  let timeout;
  try { await Promise.race([stopped,new Promise((_, reject)=>{timeout=setTimeout(()=>reject(Error('Owned application failed to quit normally')),20000);})]); } finally { clearTimeout(timeout); }
  rows.push({normalExit:true,pid:app.pid,exitCode:app.exitCode});
}
async function run(script,folder,args=[]){
  const dir=path.join(evidence,folder);await fs.mkdir(dir,{recursive:true});
  const child=spawn(process.execPath,[script,...args],{env:{...env,NAND_ACCEPTANCE_DIR:dir,NAND_ACCEPTANCE_CASE:selected},stdio:'inherit'});
  const [code]=await once(child,'exit');assert.equal(code,0,script+' failed');
}
try{
  await launch();
  await run('scripts/obsidian-acceptance/workbench-probe.mjs','workbench');
  
  await delay(1000);await stop();await launch();
  await run('scripts/obsidian-acceptance/workbench-probe.mjs','restart',['--verify-restart']);
  await stop();
  await fs.writeFile(path.join(evidence,'result.json'),JSON.stringify({passed:true,sourceCommit:process.env.GITHUB_SHA??null,platform:process.platform,mainSha256,rows},null,2));
}catch(error){
  if(connection){try{const shot=await connection.send('Page.captureScreenshot');await fs.writeFile(path.join(evidence,'failure.png'),Buffer.from(shot.data,'base64'));}catch{}}
  await fs.writeFile(path.join(evidence,'partial.json'),JSON.stringify({passed:false,sourceCommit:process.env.GITHUB_SHA??null,platform:process.platform,mainSha256,rows,error:String(error)},null,2));throw error;
}finally{
  try{await stop();}catch(error){console.error('Owned fixture cleanup failed',String(error));process.exitCode=1;}
  connection?.close();
}
