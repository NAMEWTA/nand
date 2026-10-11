// Actual generated Node CLI, local named pipe/socket and native Obsidian guests. No external account.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { inspectLayout } from './workspace-history.mjs';

const p='app.plugins.plugins.nand',json=JSON.stringify,rows=[],errors=[],issued=[];
const root='[...document.querySelectorAll(".nand-browser-access")].find(e=>e.getBoundingClientRect().width>0)';
const banner='[...document.querySelectorAll("[data-access-banner]")].find(e=>e.getBoundingClientRect().width>0)';
const button=(label,scope=root)=>'[...'+scope+'.querySelectorAll("button")].find(e=>e.textContent==='+json(label)+')';
const field=label=>'[...'+root+'.querySelectorAll("input")].find(e=>e.closest("label")?.textContent.startsWith('+json(label)+'))';
let runtime,c;
const check=(name,passed,detail)=>{rows.push({name,passed,detail});assert.ok(passed,name)};
const until=async(expression,timeout=30000)=>{const end=Date.now()+timeout;let last;while(Date.now()<end){try{if(await c.evaluate(expression))return}catch(error){last=error}await delay(100)}throw Error(expression+' '+String(last??''))};
const click=async expression=>{await c.send('Page.bringToFront');let point;
 for(let attempt=0;attempt<12&&!point;attempt++){await c.evaluate('window.focus();'+expression+'?.scrollIntoView({block:"center",inline:"center"});true');await delay(150);
  point=await c.evaluate('(()=>{const e='+expression+';if(!e)return null;const r=e.getBoundingClientRect();if(!e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))return null;return{x:r.x+r.width/2,y:r.y+r.height/2}})()');}
 assert.ok(point,'visible native click target: '+expression);await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});for(const type of ['mousePressed','mouseReleased'])await c.send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});};
const type=async(expression,value)=>{await click(expression);for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await c.send('Input.insertText',{text:value})};
const bind=()=>c.evaluate('window.bc='+p+'.services.peek({owner:"browser",id:"control"});window.access='+p+'.services.peek({owner:"browser",id:"external-access"});true');
const cli=(env,method,args=[])=>new Promise((resolve,reject)=>execFile(process.execPath,[env.NAND_BROWSER_CLI,...method.split(' '),...args],{env:{...process.env,...env},timeout:75000,maxBuffer:2000000,windowsHide:true},(error,stdout)=>{try{resolve(JSON.parse(stdout))}catch{reject(Error('CLI did not return JSON: '+(error?.code??'empty')))}}));
const onPage=(page,args=[])=>['--page',page.pageId,...args];
try {
 runtime=await launchFreshVault({root:process.argv[2],port:9276,settings:{version:1,namespaces:{app:{language:'en',introSeen:true,modules:{browser:true,automations:false,home:false,agent:false,news:false,archives:false,sync:false,comments:false,notifications:false,icons:false}}}}});
 c=runtime.connection;await c.send('Runtime.enable');c.on('Runtime.exceptionThrown',event=>errors.push(event.exceptionDetails));await bind();
 await c.evaluate('app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();true');
 await c.evaluate(p+'.openWorkbench({feature:"browser",section:"access"},window)');await until('!!'+root);
 check('local-access-is-registered-and-default-off-with-no-guest-or-bridge',await c.evaluate('!!access&&access.list().length===0&&bc.list().length===0&&!app.workspace.getLeavesOfType("nand-workbench-view").flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==="nand-browser-access").module.bridge'));
 const html=await fs.readFile('scripts/fixtures/workflow-page.html','utf8');
 await c.evaluate('(async()=>{const remote=require("@electron/remote");window.accessSession=remote.session.fromPartition("persist:nand-browser-"+app.loadLocalStorage("nand.browser.vault-id"));await new Promise((resolve,reject)=>accessSession.protocol.interceptBufferProtocol("https",(request,reply)=>reply(new URL(request.url).origin==="https://workflow.example.test"?{mimeType:"text/html",data:Buffer.from('+json(html)+')}:{statusCode:403,data:Buffer.from("")}),e=>e?reject(e):resolve()));})()');
 const pages=[];
 for(const name of ['A','B']) {
  const target=await c.evaluate('bc.open({url:'+json('https://workflow.example.test/form/?page='+name)+',target:"tab"})');pages.push(target);
  await until('bc.list().some(p=>p.target.pageId==='+json(target.pageId)+'&&!p.loading)');
  await c.evaluate('window.accessGuest'+name+'=require("@electron/remote").webContents.fromId([...document.querySelectorAll("webview")].find(e=>e.getBoundingClientRect().width>0).getWebContentsId());true');
  await until('accessGuest'+name+'.executeJavaScript("!!window.resetWorkflow")');await c.evaluate('accessGuest'+name+'.executeJavaScript('+json('document.title="Granted page '+name+'";true')+')');
  await until('bc.list().some(p=>p.target.pageId==='+json(target.pageId)+'&&p.title==='+json('Granted page '+name)+')');
 }
 const [a,b]=pages;
 const open=async()=>{await c.evaluate(p+'.openWorkbench({feature:"browser",section:"access"},window)');await until('!!'+root)};
 await open();await inspectLayout({c,p,root,runtime,check},'external-access-form',root);
 const issue=async(purpose,operations,minutes='10',limit='100')=>{
  await open();await type(field('Task or purpose'),purpose);
  const pageField='[...'+root+'.querySelectorAll("fieldset")].find(e=>e.querySelector("legend")?.textContent==="Authorized pages and accounts")';
  const choice='[...'+pageField+'.querySelectorAll("label")].find(e=>e.textContent.includes("Granted page A")).querySelector("input")';
  if(!await c.evaluate(choice+'.checked'))await click(choice);
  for(const label of await c.evaluate('[...'+root+'.querySelectorAll(".nand-browser-assistant-operations label")].map(e=>e.textContent.trim())')){
   const input='[...'+root+'.querySelectorAll(".nand-browser-assistant-operations label")].find(e=>e.textContent.trim()==='+json(label)+').querySelector("input")';
   if(await c.evaluate(input+'.checked')!==operations.includes(label))await click(input);
  }
  await type(field('Time limit in minutes'),minutes);await type(field('Operation limit'),limit);
  await click(button('Review access'));await until('!!'+root+'.querySelector("[data-access-review]")');await click(button('Create limited connection'));await until('!!'+root+'.querySelector("[data-access-connection]")');
  const command=await c.evaluate(root+'.querySelector("[data-access-connection] pre").textContent'),env={};
  for(const line of command.split('\n')){const match=line.match(/^\$env:(NAND_BROWSER_\w+)='((?:''|[^'])*)';$/);if(match)env[match[1]]=match[2].replaceAll("''", "'")}
  assert.ok(env.NAND_BROWSER_TOKEN&&env.NAND_BROWSER_TASK&&env.NAND_BROWSER_CLI&&env.NAND_BROWSER_CONTEXT,'one-time Windows connection command');
  const id=await c.evaluate(root+'.querySelector("[data-access-connection]").dataset.accessConnection');issued.push({id,env});await click(button('Hide connection'));await until('!'+root+'.querySelector("[data-access-connection]")');return{id,env};
 };
 const reader=await issue('Read page A',['Observe page','Read element']);
 const listing=await cli(reader.env,'tab list');check('real-generated-cli-lists-only-the-authorized-page',listing.ok&&listing.result.tabs.length===1&&listing.result.tabs[0].id===a.pageId);
 await c.evaluate('window.beforeAccessFocus=document.activeElement;window.beforeAccessLeaf=app.workspace.activeLeaf;true');
 const observation=await cli(reader.env,'snapshot',onPage(a));check('background-native-snapshot-does-not-reveal-page-or-take-focus',observation.ok&&await c.evaluate('document.activeElement===beforeAccessFocus&&app.workspace.activeLeaf===beforeAccessLeaf'));
 for(const [name,method,args] of [['other-page','snapshot',onPage(b)],['other-account','snapshot',onPage(a,['--profileId','wrong'])],['other-task','snapshot',onPage(a,['--taskId','wrong'])],['write','fill',onPage(a,['--expectedValue=','--value','forbidden'])],['arbitrary-eval','eval',onPage(a)]]){
  const result=await cli(reader.env,method,args);check('scoped-cli-denies-'+name,!result.ok&&result.error.code==='browser_scoped_grant_scope'&&!!result.error.retryAction);
 }
 const connectionFiles=await fs.readdir(path.dirname(reader.env.NAND_BROWSER_CONTEXT));
 check('runtime-files-and-public-grant-list-contain-no-token',(await Promise.all(connectionFiles.map(file=>fs.readFile(path.join(path.dirname(reader.env.NAND_BROWSER_CONTEXT),file),'utf8')))).every(text=>!text.includes(reader.env.NAND_BROWSER_TOKEN))&&!json(await c.evaluate('access.list()')).includes(reader.env.NAND_BROWSER_TOKEN));
 await click(button('Revoke access',root+'.querySelector("[data-access-grant=\\"'+reader.id+'\\"]")'));
 check('ui-revocation-invalidates-the-real-client-token',!(await cli(reader.env,'snapshot',onPage(a))).ok);
 const writer=await issue('Edit page A',['Observe page','Read element','Reveal selected page','Replace field text','Click after confirmation']);
 await cli(writer.env,'tab switch',onPage(a));let shot=await cli(writer.env,'snapshot',onPage(a));let ref=shot.result.refs.find(r=>r.role==='text input'&&r.name==='Message');
 const fill=await cli(writer.env,'fill',onPage(a,['--revision',shot.result.revision,'--element',ref.ref,'--expectedValue=','--value','external native draft']));
 check('explicit-write-grant-fills-the-original-guest',fill.ok&&await c.evaluate('accessGuestA.executeJavaScript('+json('document.querySelector("#message").value==="external native draft"')+')'));
 shot=await cli(writer.env,'snapshot',onPage(a));ref=shot.result.refs.find(r=>r.role==='button'&&r.name==='Apply');
 const submit=cli(writer.env,'click',onPage(a,['--revision',shot.result.revision,'--element',ref.ref]));await until('!!'+banner+'?.querySelector(".nand-browser-consequence")');
 check('external-submission-awaits-original-page-final-confirmation',await c.evaluate('accessGuestA.executeJavaScript("workflowSubmissions")')===0);
 await click(button('Confirm this action once',banner));check('one-confirmed-external-action-submits-once',(await submit).ok&&await c.evaluate('accessGuestA.executeJavaScript("workflowSubmissions")')===1);
 const competitor=await issue('Concurrent reader',['Observe page','Read element']);await cli(writer.env,'tab switch',onPage(a));
 shot=await cli(writer.env,'snapshot',onPage(a));ref=shot.result.refs.find(r=>r.role==='button'&&r.name==='Apply');
 const waiting=cli(writer.env,'click',onPage(a,['--revision',shot.result.revision,'--element',ref.ref]));await until('!!'+banner+'?.querySelector(".nand-browser-consequence")');
 const conflict=await cli(competitor.env,'snapshot',onPage(a));check('another-grant-cannot-displace-an-existing-native-page-owner',!conflict.ok&&conflict.error.code==='browser_workspace_busy');
 await click(button('Revoke access and take over',banner));
 check('human-takeover-revokes-all-page-grants-and-cancels-waiting-click',!(await waiting).ok&&!(await cli(competitor.env,'snapshot',onPage(a))).ok&&await c.evaluate('accessGuestA.executeJavaScript("workflowSubmissions")')===1);
 const expires=await issue('Expires while waiting',['Observe page','Reveal selected page','Click after confirmation'],'1');
 await cli(expires.env,'tab switch',onPage(a));shot=await cli(expires.env,'snapshot',onPage(a));ref=shot.result.refs.find(r=>r.role==='button'&&r.name==='Apply');
 const expiring=cli(expires.env,'click',onPage(a,['--revision',shot.result.revision,'--element',ref.ref]));await until('!!'+banner+'?.querySelector(".nand-browser-consequence")');
 await until('access.list().find(g=>g.id==='+json(expires.id)+').state==="expired"',70000);
 check('real-one-minute-expiry-aborts-pending-native-confirmation',!(await expiring).ok&&await c.evaluate('accessGuestA.executeJavaScript("workflowSubmissions")')===1);
 const last=await issue('Module shutdown grant',['Observe page','Read element']);await open();await c.evaluate(p+'.changeLanguage("zh")');await until(root+'.textContent.includes("本地浏览器外接")');await runtime.shot('external-access-grants-zh');
 await c.evaluate(p+'.setModuleEnabled("browser",false)');check('module-disable-removes-service-and-connection-file',!await c.evaluate(p+'.services.peek({owner:"browser",id:"external-access"})')&&!await fs.stat(last.env.NAND_BROWSER_CONTEXT).then(()=>true,()=>false));
 await c.evaluate(p+'.setModuleEnabled("browser",true)');await bind();check('module-reenable-does-not-reissue-credentials-or-open-guests',await c.evaluate('access.list().length===0&&bc.list().length===0'));
 await runtime.restart();c=runtime.connection;await bind();check('restart-never-restores-grants-or-guests',await c.evaluate('access.list().length===0&&bc.list().length===0'));
 check('no-host-exceptions',errors.length===0,errors);
 await fs.writeFile(path.join(runtime.evidence,'external-access.json'),json({rows,errors,bytes:{main:(await fs.stat('main.js')).size,styles:(await fs.stat('styles.css')).size}}));console.log(json({passed:rows.length,evidence:runtime.evidence}));
}catch(error){if(runtime){const credentialVisible=await c?.evaluate('!!document.querySelector("[data-access-connection]")').catch(()=>true);if(!credentialVisible)await runtime.shot('external-access-failure').catch(()=>{});const body=await c?.evaluate('document.body.innerText').catch(()=>'');let safe=(body??'').replace(/\b[a-f\d]{64}\b/gi,'[REDACTED]');for(const item of issued)safe=safe.replaceAll(item.env.NAND_BROWSER_TOKEN,'[REDACTED]');await fs.writeFile(path.join(runtime.evidence,'external-access-failure.json'),json({error:String(error),rows,errors,body:safe}));}throw error}
finally{await runtime?.stop()}
