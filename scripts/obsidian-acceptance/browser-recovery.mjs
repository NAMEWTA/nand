// Uninstrumented production workspace and three local provider fixtures in real Obsidian.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const p = 'app.plugins.plugins.nand', json = JSON.stringify, rows = [], hostErrors = [], providers = ['deepseek', 'kimi', 'chatgpt'];
const origins = ['https://chat.deepseek.com', 'https://www.kimi.com', 'https://chatgpt.com'];
const root = '[...document.querySelectorAll(".nand-browser-workspace")].find(e=>e.getBoundingClientRect().width>0)';
const row = index => root + '.querySelectorAll(".nand-browser-workspace-targets>section")[' + index + ']';
const button = (label, scope = root) => '[...' + scope + '.querySelectorAll("button")].find(e=>e.textContent===' + json(label) + ')';
let runtime, c, taskId, environment, lock;
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const until = async expression => {
 const end = Date.now() + 30000; let last;
 while (Date.now() < end) { try { if (await c.evaluate(expression)) return; } catch (error) { last = error; } await delay(80); }
 throw Error(expression + (last ? ' ' + String(last) : ''));
};
const click = async expression => {
 await c.send('Page.bringToFront');
 await c.evaluate('window.focus();' + expression + '.scrollIntoView({block:"center",inline:"center"});true'); await delay(150);
 const point = await c.evaluate('(()=>{const r=' + expression + '.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
 await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
 await until('(()=>{const e=' + expression + ',r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()');
 for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
};
const type = async (expression, text) => {
 await click(expression);
 for (const type of ['keyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
 await c.send('Input.insertText', { text });
};
const key = async (key, code, windowsVirtualKeyCode, text) => {
 for (const type of ['keyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode, ...(type === 'keyDown' && text ? { text } : {}) });
};
const guest = (index, expression) => c.evaluate('fixtureGuests[' + index + '].executeJavaScript(' + json(expression) + ')');
const counts = () => c.evaluate('Promise.all(fixtureGuests.map(g=>g.executeJavaScript("fixtureCount()")))');
const bind = () => c.evaluate('window.bw=' + p + '.services.peek({owner:"browser",id:"workspace"});window.bc=' + p + '.services.peek({owner:"browser",id:"control"});true');
const preview = async () => { await click(button('Preview send')); await until('!!' + root + '.querySelector(".nand-browser-workspace-preview")'); };
const send = async count => {
 await click(button('Send this preview'));
 await until('bw.snapshot().turns.length===' + count + '&&!bw.busy(taskId)&&!' + button('Preview send') + '?.disabled');
};
const cli = async (...args) => {
 try {
  const { stdout } = await promisify(execFile)(process.execPath, [environment.NAND_BROWSER_CLI, ...args], { env: { ...process.env, ...environment } });
  return JSON.parse(stdout);
 } catch (error) { if (error.stdout) return JSON.parse(error.stdout); throw error; }
};
try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9276, settings: { version: 1, namespaces: {
  app: { language: 'en', introSeen: true, modules: { browser: true, home: false, agent: false, news: false, archives: false, sync: false, comments: false, notifications: false, automations: false, icons: false } }, browser: { agentAccess: true },
 } } }); c = runtime.connection;
 c.on('Runtime.exceptionThrown', event => hostErrors.push({ lastCheck: rows.at(-1)?.name, details: event.exceptionDetails })); await c.send('Runtime.enable');
 await bind(); await c.evaluate('app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();true');
 environment = await c.evaluate(p + '.services.peek({owner:"browser",id:"agent-bridge"}).environment()');
 await c.evaluate(p + '.openWorkbench({feature:"browser",section:"multi-ai"},window)'); await until('!!' + root + '&&!!bw.snapshot()');
 await type(root + '.querySelector("input[type=text]")', 'Three provider research'); await click(button('Create task'));
 await until('bw.snapshot().tasks.length===1&&!!' + root + '.querySelector("textarea")');
 taskId = await c.evaluate('bw.snapshot().tasks[0].id'); await c.evaluate('window.taskId=' + json(taskId) + ';true');
 for (const provider of ['kimi', 'chatgpt']) {
  await click(root + '.querySelector("select")'); await key('ArrowDown', 'ArrowDown', 40); await key('Enter', 'Enter', 13);
  await until(root + '.querySelector("select").value===' + json(provider)); await click(button('Add target'));
  await until('bw.snapshot().tasks[0].targets.length===' + (providers.indexOf(provider) + 1));
 }
 check('native-target-management-does-not-open-or-select-added-targets', await c.evaluate('bc.list().length===0&&bw.snapshot().tasks[0].selectedTargetIds.length===1&&bw.snapshot().tasks[0].visibleTargetIds.length===1'));
 await click(button('Select all targets')); await until('bw.snapshot().tasks[0].selectedTargetIds.length===3');
 const setupFixtures = async () => {
 const html = await Promise.all(providers.map(provider => fs.readFile('scripts/fixtures/' + provider + '-page.html', 'utf8')));
 await c.evaluate('(async()=>{window.fixtureHtml=' + json(html) + ';window.fixtureGuests=[];window.fixtureRequests=[];window.fixtureOrigins=' + json(origins) + ';const session=require("@electron/remote").session.fromPartition("persist:nand-browser-"+app.loadLocalStorage("nand.browser.vault-id"));await new Promise((resolve,reject)=>session.protocol.interceptBufferProtocol("https",(request,reply)=>{void(async()=>{const u=new URL(request.url),i=fixtureOrigins.indexOf(u.origin);if(i<0){reply({statusCode:403,data:Buffer.from("")});return}fixtureRequests.push({provider:i,path:u.pathname});if(u.pathname==="/api/v0/chat/history_messages"||u.pathname==="/apiv2/kimi.gateway.chat.v1.ChatService/ListMessages"||u.pathname.startsWith("/backend-api/conversation/")){const cursor=i===1?JSON.parse(Buffer.concat((request.uploadData??[]).map(p=>p.bytes??Buffer.alloc(0))).toString()).page_token:undefined;const body=await fixtureGuests[i].executeJavaScript("JSON.stringify(fixtureHistory("+JSON.stringify(cursor)+"))");reply({mimeType:"application/json",data:Buffer.from(body)})}else reply({mimeType:"text/html",data:Buffer.from(fixtureHtml[i])})})().catch(error=>{window.fixtureInterceptError=String(error);reply({statusCode:500,data:Buffer.from("")})})},error=>error?reject(error):resolve()));})()');
 for (let index = 0; index < 3; index++) {
  await click(button('Open official page', row(index))); await until('bc.list().length===' + (index + 1) + '&&bc.list().every(p=>!p.loading)');
  await c.evaluate('fixtureGuests[' + index + ']=require("@electron/remote").webContents.fromId(document.querySelectorAll(".nand-browser-workspace-pane webview")[' + index + '].getWebContentsId());true');
  await until('fixtureGuests[' + index + '].executeJavaScript("!!document.querySelector(\'.fixture-composer\')")');
  await guest(index, '(()=>{window.fixtureEvents=[];for(const type of ["focusin","keydown","beforeinput","input"])document.addEventListener(type,e=>fixtureEvents.push({type,key:e.key,inputType:e.inputType,value:document.querySelector(".fixture-composer").value??document.querySelector(".fixture-composer").innerText}),true)})()');
  await click(button('New website conversation', row(index)));
  await until('!bw.busy(taskId)&&bw.snapshot().tasks[0].targets[' + index + '].status==="ready"');
 }
 };
 await setupFixtures();
 check('three-official-pages-have-distinct-bound-generations', await c.evaluate('new Set(bw.snapshot().tasks[0].targets.map(t=>t.page.generation)).size===3&&bc.list().length===3'));

 const recoverRoot='[...document.querySelectorAll(".nand-browser-recovery")].find(e=>e.getBoundingClientRect().width>0)';
 const reopen=async()=>{c=runtime.connection;await bind();await c.evaluate('window.taskId='+json(taskId)+';true');await c.evaluate(p+'.openWorkbench({feature:"browser",section:"multi-ai",resourceId:'+json(taskId)+'},window)');await until('!!bw.snapshot()');};
 const answerFile=async id=>await c.evaluate('app.vault.getMarkdownFiles().find(f=>f.basename==='+json(id)+')?.path');
 for(let i=0;i<3;i++)await guest(i,'window.fixtureDelay='+(i===0?900:60000)+';true');
 await type(root+'.querySelector("textarea")','Persist the fast answer');await preview();await click(button('Send this preview'));
 await until('bw.snapshot().exchanges.length===3&&bw.snapshot().exchanges.every(e=>e.submitState==="submitted")');
 await until('bw.snapshot().exchanges[0].captures.length===1&&bw.snapshot().exchanges[0].saveState==="saved"');
 let data=await c.evaluate('bw.snapshot()');const fast=data.exchanges[0],fastPath=await answerFile(fast.id);
 check('fast-answer-written-before-other-providers-finish',await c.evaluate('bw.busy(taskId)')&&(await fs.readFile(path.join(runtime.vault,fastPath),'utf8')).includes(fast.captures[0].id)&&json(await counts())==='[2,1,1]');
 await runtime.crashRestart();await reopen();data=await c.evaluate('bw.snapshot()');
 check('hard-crash-retains-fast-answer-and-confirmed-slow-receipts-without-reopening-guests',data.exchanges.find(e=>e.id===fast.id)?.captures[0]?.id===fast.captures[0].id&&data.exchanges.find(e=>e.id===fast.id).acquisitionState==='complete'&&data.exchanges.filter(e=>e.id!==fast.id).every(e=>e.submitState==='submitted'&&e.acquisitionState==='incomplete'&&e.attempts.length===1)&&await c.evaluate('bc.list().length===0'));
 await setupFixtures();for(let i=0;i<3;i++)await guest(i,'window.fixtureDelay=6000;true');
 await type(root+'.querySelector("textarea")','Recovery after an actual file write failure');await preview();await click(button('Send this preview'));
 await until('bw.snapshot().turns.length===2&&bw.snapshot().exchanges.filter(e=>e.turnId===bw.snapshot().turns.toSorted((a,b)=>a.sequence-b.sequence).at(-1).id).every(e=>e.submitState==="submitted")');
 const pending=await c.evaluate('bw.snapshot().exchanges.filter(e=>e.turnId===bw.snapshot().turns.toSorted((a,b)=>a.sequence-b.sequence).at(-1).id)'),lockedRelative=await answerFile(pending[0].id);
 const annotate=text=>text.replace(/^---\r?\n/,'---\ncustom-label: Keep\n')+'\nHuman note outside the owned answer.\n';
 await c.evaluate('app.vault.process(app.vault.getAbstractFileByPath('+json(lockedRelative)+'),'+annotate.toString()+').then(()=>true)');
 const lockedPath=path.resolve(runtime.vault,lockedRelative);assert.ok(lockedPath.startsWith(path.resolve(runtime.vault)+path.sep));assert.equal(process.platform,'win32','This acceptance uses a Windows sharing lock.');
 const command="$ErrorActionPreference = 'Stop'; $fixtureLock = [System.IO.File]::Open('"+lockedPath.replaceAll("'","''")+"', [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read); [Console]::WriteLine('LOCKED'); [Console]::ReadLine() | Out-Null; $fixtureLock.Dispose()";
 lock=spawn('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('File lock startup timeout')),10000);lock.stdout.on('data',chunk=>{output+=chunk;if(output.includes('LOCKED')){clearTimeout(timer);resolve()}});lock.once('error',reject);lock.once('exit',code=>{clearTimeout(timer);if(!output.includes('LOCKED'))reject(Error('File lock exited '+code))})});
 await until('!bw.busy(taskId)&&bw.snapshot().exchanges.filter(e=>e.turnId===bw.snapshot().turns.toSorted((a,b)=>a.sequence-b.sequence).at(-1).id).every(e=>e.captures.length===1&&e.saveState==="failed")');
 check('os-sharing-failure-keeps-all-three-proven-answers-in-memory',await c.evaluate('bw.snapshot().exchanges.filter(e=>e.turnId===bw.snapshot().turns.toSorted((a,b)=>a.sequence-b.sequence).at(-1).id).every(e=>e.submitState==="submitted"&&e.acquisitionState==="complete")')&&json(await counts())==='[2,2,2]');
 await click(button('Review local recovery',recoverRoot));await until('!!'+recoverRoot+'.querySelector("[data-recovery-id] button")');await click(recoverRoot+'.querySelector("[data-recovery-id] button")');await until(''+recoverRoot+'.querySelector("code").textContent.endsWith(".json")');
 const recoveryFile=await c.evaluate(recoverRoot+'.querySelector("code").textContent');
 const protectedDraft=JSON.parse(await fs.readFile(path.join(runtime.vault,recoveryFile),'utf8'));
 check('scoped-runtime-recovery-snapshot-contains-every-later-answer',pending.every(e=>protectedDraft.draft.exchanges.find(row=>row.id===e.id).captures.length===1)&&protectedDraft.path.includes(encodeURIComponent('NAND/AI Workspace')));
 // Keep the real sharing failure in place across abrupt process termination.
 await runtime.crashRestart();c=runtime.connection;await bind();await c.evaluate('window.taskId='+json(taskId)+';true');await c.evaluate(p+'.openWorkbench({feature:"browser",section:"multi-ai",resourceId:'+json(taskId)+'},window)');
 await until('!!'+button('Review local recovery','document'));await click(button('Review local recovery','document'));await until('!!'+button('Read saved answers',recoverRoot));
 await click(button('Read saved answers',recoverRoot));await until('!!'+recoverRoot+'.querySelector(".nand-browser-answer table")');
 check('readonly-local-answers-remain-readable-while-recovery-save-is-blocked',await c.evaluate('bc.list().length===0&&!!'+recoverRoot+'.querySelector(".nand-browser-answer table")'));
 const exited=once(lock,'exit');lock.stdin.end('\n');await exited;lock=undefined;
 await click(button('Review local recovery',recoverRoot));await until('!!'+recoverRoot+'.querySelector("[data-recovery-id]")');await click(recoverRoot+'.querySelector('+json('[data-recovery-id="'+path.basename(recoveryFile,'.json')+'"] button')+')');await until('!!'+button('Restore reviewed draft',recoverRoot));await click(button('Read recovery draft',recoverRoot));
 check('recovery-preview-exposes-complete-content-and-exact-scope',await c.evaluate(recoverRoot+'.textContent.includes("2 rounds")&&'+recoverRoot+'.textContent.includes("4 answer captures")&&'+recoverRoot+'.querySelectorAll(".nand-browser-answer table").length===4'));
 for(const preset of ['system','claude-code','eye-care'])for(const dark of [false,true])for(const width of [500,800,1500]){
  await c.evaluate(p+'.theme.update(d=>{d.preset='+json(preset)+'});app.changeTheme('+json(dark?'obsidian':'moonstone')+');true');await c.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(80);
  const layout=await c.evaluate('(()=>{const e='+recoverRoot+';return{width:e.clientWidth,scroll:e.scrollWidth,small:[...e.querySelectorAll("button,summary")].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height<32).length}})()');
  check('recovery-'+preset+'-'+(dark?'dark':'light')+'-'+width,layout.width>0&&layout.scroll<=layout.width+1&&layout.small===0,layout);
 }
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:true});await c.send('Emulation.setDeviceMetricsOverride',{width:500,height:1000,deviceScaleFactor:1,mobile:true});await delay(100);
 check('recovery-touch-controls-have44px-targets',await c.evaluate('[...'+recoverRoot+'.querySelectorAll("button,summary")].filter(e=>e.getClientRects().length).every(e=>e.getBoundingClientRect().height>=44)'));
 await runtime.shot('recovery-preview-500');await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});await c.send('Emulation.clearDeviceMetricsOverride');
 await click(button('Restore reviewed draft',recoverRoot));await until('!!bw.snapshot()&&bw.snapshot().exchanges.filter(e=>e.turnId===bw.snapshot().turns.find(t=>t.sequence===2).id).every(e=>e.acquisitionState==="complete"&&e.saveState==="saved")');
 const restoredData=await c.evaluate('bw.snapshot()');
 check('explicit-restore-keeps-all-capture-ids-and-does-not-send',await c.evaluate('bc.list().length===0&&bw.snapshot().turns.length===2&&bw.snapshot().exchanges.every(e=>e.attempts.length===1)')&&pending.every(e=>restoredData.exchanges.find(row=>row.id===e.id).captures[0].id===protectedDraft.draft.exchanges.find(row=>row.id===e.id).captures[0].id));
 const repaired=await fs.readFile(lockedPath,'utf8');check('restoration-preserves-unknown-frontmatter-and-author-notes',repaired.includes('custom-label: Keep')&&repaired.includes('Human note outside the owned answer.')&&repaired.includes(protectedDraft.draft.exchanges.find(e=>e.id===pending[0].id).captures[0].id));
 const privateRoot=path.join(runtime.vault,'.nand','browser'),folders=await fs.readdir(privateRoot,{withFileTypes:true});let journalFile;
 for(const folder of folders.filter(f=>f.isDirectory())){const candidate=path.join(privateRoot,folder.name,'workspace-journal.json');if(await fs.stat(candidate).catch(()=>undefined)){assert.equal(journalFile,undefined);journalFile=candidate}}
 assert.ok(journalFile);const journalBefore=await fs.readFile(journalFile,'utf8');await fs.writeFile(journalFile,'{broken journal');await runtime.crashRestart();c=runtime.connection;await bind();await c.evaluate('window.taskId='+json(taskId)+';true');await c.evaluate(p+'.openWorkbench({feature:"browser",section:"multi-ai",resourceId:'+json(taskId)+'},window)');
 await until('!!'+button('Review local recovery','document'));await click(button('Review local recovery','document'));await until('!!'+button('Read saved answers',recoverRoot));await click(button('Read saved answers',recoverRoot));await until(recoverRoot+'.querySelectorAll(".nand-browser-answer table").length===4');
 check('broken-journal-does-not-hide-saved-answers-or-overwrite-bad-storage',(await fs.readFile(journalFile,'utf8'))==='{broken journal'&&await c.evaluate('bc.list().length===0'));
 await fs.writeFile(journalFile,journalBefore);await click(button('Reload tasks','document'));await until('!!bw.snapshot()&&'+root+'.querySelectorAll(".nand-browser-workspace-targets>section").length===3');
 await setupFixtures();await type(root+'.querySelector("textarea")','Crash after durable dispatch intent');await preview();
 await c.evaluate('(()=>{const a=app.vault.adapter,write=a.write.bind(a);a.write=async(path,text,...rest)=>{await write(path,text,...rest);if(path.endsWith("workspace-journal.json")&&JSON.parse(text).attempts.some(row=>row.outcome==="dispatching")){window.dispatchDurable=true;await new Promise(()=>{})}};return true})()');
 await click(button('Send this preview'));await until('window.dispatchDurable===true');
 check('crash-point-has-real-durable-dispatch-intent-before-native-submit',JSON.parse(await fs.readFile(journalFile,'utf8')).attempts.some(row=>row.outcome==='dispatching')&&json(await counts())==='[0,0,0]');
 await runtime.crashRestart();await reopen();
 const last=await c.evaluate('(()=>{const d=bw.snapshot(),t=d.turns.toSorted((a,b)=>a.sequence-b.sequence).at(-1);return t.targets.map(target=>d.exchanges.find(e=>e.turnId===t.id&&e.targetId===target.id))})()');
 check('interrupted-dispatch-is-unknown-and-staged-peers-stay-paused-without-guests',json(last.map(e=>e.submitState))===json(['unknown','paused','paused'])&&last.every(e=>e.attempts.length===1)&&await c.evaluate('bc.list().length===0'),last.map(e=>({submit:e.submitState,outcome:e.attempts[0].outcome})));
 await fs.writeFile(path.join(runtime.evidence,'result.json'),json({method:'Production main.js, real Windows Obsidian Vault, OS FileShare.Read lock, owned process SIGKILL/restarts and local official-origin HTTPS fixtures. No real provider account or POSIX proof.',rows},null,2));
}catch(error){if(runtime){await runtime.shot('failure').catch(()=>undefined);await fs.writeFile(path.join(runtime.evidence,'partial.json'),json({rows,error:String(error),state:await c.evaluate('({data:window.bw?.snapshot(),body:document.body.innerText,errors:window.nandAcceptanceErrors})').catch(String)},null,2))}throw error;
}finally{if(lock&&lock.exitCode===null){const ended=once(lock,'exit');lock.stdin.end('\n');await ended;}if(runtime){console.log(json({evidence:runtime.evidence,checks:rows.length,failed:rows.filter(row=>!row.passed)}));await runtime.stop();}}
