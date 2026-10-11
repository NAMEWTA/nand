// Real module, shared owner, shell and native input against a fully local HTTPS fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { inspectLayout } from './workspace-history.mjs';

const p='app.plugins.plugins.nand',json=JSON.stringify,rows=[],errors=[];
const root='[...document.querySelectorAll(".nand-browser-workflows")].find(e=>e.getBoundingClientRect().width>0)';
const banner='document.querySelector("[data-workflow-banner]")';
const button=(label,scope=root)=>'[...'+scope+'.querySelectorAll("button")].find(e=>e.textContent==='+json(label)+')';
let runtime,c;
const check=(name,passed,detail)=>{rows.push({name,passed,detail});assert.ok(passed,name)};
const until=async expression=>{const end=Date.now()+30000;let last;while(Date.now()<end){try{if(await c.evaluate(expression))return}catch(error){last=error}await delay(100)}throw Error(expression+' '+String(last??''))};
const click=async expression=>{await c.send('Page.bringToFront');let point;
 for(let attempt=0;attempt<12&&!point;attempt++){await c.evaluate('window.focus();'+expression+'?.scrollIntoView({block:"center",inline:"center"});true');await delay(150);
  point=await c.evaluate('(()=>{const e='+expression+';if(!e)return null;const r=e.getBoundingClientRect();if(!e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))return null;return{x:r.x+r.width/2,y:r.y+r.height/2}})()');}
 assert.ok(point,'visible native click target: '+expression);
 await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});for(const type of ['mousePressed','mouseReleased'])await c.send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});};
const type=async(expression,value)=>{await click(expression);for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await c.send('Input.insertText',{text:value})};
const select=async(expression,value)=>{const index=await c.evaluate('[...'+expression+'.options].findIndex(o=>o.value==='+json(value)+')');assert.ok(index>=0,'available select option');await click(expression);
 for(const [key,code] of [['Home',36],...Array.from({length:index},()=>['ArrowDown',40]),['Enter',13]])for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:code});await until(expression+'.value==='+json(value));};
const field=label=>'[...'+root+'.querySelectorAll("input")].find(e=>e.closest("label")?.textContent.startsWith('+json(label)+'))';
const bind=()=>c.evaluate('window.bc='+p+'.services.peek({owner:"browser",id:"control"});window.flows='+p+'.services.peek({owner:"browser",id:"workflows"});window.owner='+p+'.services.peek({owner:"automations",id:"workflow-invocations"});true');
try {
 runtime=await launchFreshVault({root:process.argv[2],port:9276,settings:{version:1,namespaces:{app:{language:'en',introSeen:true,modules:{browser:true,automations:true,home:false,agent:false,news:false,archives:false,sync:false,comments:false,notifications:false,icons:false}}}}});
 c=runtime.connection;await c.send('Runtime.enable');c.on('Runtime.exceptionThrown',event=>errors.push(event.exceptionDetails));await bind();
 await c.evaluate('app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();true');
 check('workflow-and-owner-services-registered-with-no-guest-or-agent',await c.evaluate('!!flows&&!!owner&&bc.list().length===0&&!'+p+'.services.peek({owner:"agent",id:"automation-runtime"})'));
 await c.evaluate(p+'.openWorkbench({feature:"browser",section:"workflows"},window)');await until('!!'+root);
 check('existing-shell-workflow-route-opens-only-local-documents',await c.evaluate('bc.list().length===0&&flows.definitions().length===0'));
 const html=await fs.readFile('scripts/fixtures/workflow-page.html','utf8');
 await c.evaluate('(async()=>{const remote=require("@electron/remote");window.flowSession=remote.session.fromPartition("persist:nand-browser-"+app.loadLocalStorage("nand.browser.vault-id"));await new Promise((resolve,reject)=>flowSession.protocol.interceptBufferProtocol("https",(request,reply)=>reply(new URL(request.url).origin==="https://workflow.example.test"?{mimeType:"text/html",data:Buffer.from('+json(html)+')}:{statusCode:403,data:Buffer.from("")}),e=>e?reject(e):resolve()));})()');
 await c.evaluate('bc.open({url:"https://workflow.example.test/form/",target:"tab"}).then(t=>{window.flowTarget=t;return true})');
 await until('bc.list().length===1&&!bc.list()[0].loading');
 await c.evaluate('window.flowView=[...document.querySelectorAll("webview")].find(e=>e.getBoundingClientRect().width>0);window.flowGuest=require("@electron/remote").webContents.fromId(flowView.getWebContentsId());true');
 await until('flowGuest.executeJavaScript("!!window.resetWorkflow")');
 await c.evaluate('bc.observe(flowTarget).then(o=>{window.flowSnapshot=o;return true})');
 check('native-accessibility-identifies-form-controls',await c.evaluate('flowSnapshot.refs.some(r=>r.role==="text input"&&r.name==="Message")&&flowSnapshot.refs.some(r=>r.role==="button"&&r.name==="Apply")'),await c.evaluate('flowSnapshot'));
 const message={role:'text input',name:'Message'},result={role:'text input',name:'Result'},apply={role:'button',name:'Apply'},value=(element,equals)=>({kind:'value',element,equals});
 const spec={id:'native-workflow',version:1,title:'Local reviewed form',description:'Controlled native workflow',variables:[{name:'message',type:'text',required:true}],targetScope:[{id:'form',profileId:'default',origin:'https://workflow.example.test',pathPrefix:'/form/'}],consequenceClass:'submission',createdAt:1,updatedAt:1,steps:[
 {id:'fill',target:'form',operation:'fill',args:{element:message,value:'{{message}}'},precondition:[value(message,'')],postcondition:[value(message,'{{message}}')]},
 {id:'submit',target:'form',operation:'click',args:{element:apply},precondition:[value(message,'{{message}}')],postcondition:[value(result,'{{message}}')]},
 {id:'read',target:'form',operation:'read',args:{element:result},precondition:[value(result,'{{message}}')],postcondition:[value(result,'{{message}}')]}]};
 await c.evaluate('flows.save('+json(spec)+')');
 const openForm=async()=>{await c.evaluate(p+'.openWorkbench({feature:"browser",section:"workflows"},window)');await until('!!'+root);await select(root+'.querySelector("select")',spec.id)};
 const launch=async(text)=>{await c.evaluate('flowGuest.executeJavaScript("resetWorkflow()")');await openForm();await type(field('message'),text);
  await select('[...'+root+'.querySelectorAll("select")].at(-1)',await c.evaluate('flowTarget.pageId'));await click(button('Review this run'));await until('!!document.querySelector("[data-workflow-review]")');
  const id=await c.evaluate('document.querySelector("[data-workflow-review]").dataset.workflowReview');await click(button('Start reviewed workflow'));await until('owner.receipt('+json(id)+')?.status==="running"&&!!'+banner+'?.querySelector(".nand-browser-consequence")');return id;};
 for(const text of ['first native variable','second native variable']) {
  const id=await launch(text);check('reviewed-native-fill-waits-before-submitting-'+text,await c.evaluate('flowGuest.executeJavaScript('+json('document.querySelector("#message").value==='+json(text)) +')'));
  await click(button('Confirm this action once',banner));await until('owner.receipt('+json(id)+')?.status==="succeeded"');
  const receipt=await c.evaluate('owner.receipt('+json(id)+')');check('one-shared-receipt-links-native-result-'+text,await c.evaluate('flows.records().some(r=>r.runId==='+json(receipt.runId)+'&&r.phase==="succeeded"&&r.result==='+json(text)+'&&r.steps.every(s=>s.state==="succeeded"))'));
  await c.evaluate('flows.saveVerified('+json(receipt.runId)+')');
 }
 check('two-different-variable-runs-submit-exactly-twice',await c.evaluate('flowGuest.executeJavaScript("workflowSubmissions")')===2);
 const paused=await launch('pause and resume');await click(button('Take over this page',banner));await until('flows.records().find(r=>r.runId===owner.receipt('+json(paused)+').runId).phase==="paused"');
 check('takeover-releases-native-control-with-no-submission',await c.evaluate('flowGuest.executeJavaScript("workflowSubmissions")')===2);
 await click(button('Resume with fresh checks',banner));await until('!!'+banner+'?.querySelector(".nand-browser-consequence")');await click(button('Confirm this action once',banner));await until('owner.receipt('+json(paused)+')?.status==="succeeded"');
 check('same-run-resumes-with-a-new-native-confirmation-once',await c.evaluate('flowGuest.executeJavaScript("workflowSubmissions")')===3);
 const cancelled=await launch('cancel this');await click(button('Stop',banner));await until('owner.receipt('+json(cancelled)+')?.status==="cancelled"');
 check('cancellation-keeps-accepted-count-and-stops-following-steps',await c.evaluate('flowGuest.executeJavaScript("workflowSubmissions")')===3);
 await c.evaluate('flowGuest.executeJavaScript('+json('resetWorkflow();document.querySelector("#submit").focus();document.querySelector("#message").addEventListener("focus",()=>{document.querySelector("#message").value="human focus draft"},{once:true});true')+')');
 const guarded=await c.evaluate('bc.observe(flowTarget).then(o=>bc.act(flowTarget,{kind:"fill",ref:{revision:o.revision,element:o.refs.find(r=>r.role==="text input"&&r.name==="Message").ref},value:"must not overwrite",expectedValue:""})).then(()=>"unexpected",e=>e.code)');
 check('native-fill-rechecks-draft-after-focus-event',guarded==='browser_workspace_draft_changed'&&await c.evaluate('flowGuest.executeJavaScript('+json('document.querySelector("#message").value==="human focus draft"')+')'));
 // Author a harmless workflow in the real editor, then reuse it through the existing scheduler.
 await openForm(); await click(button('New workflow'));
 const editor=root+'.querySelector(".nand-browser-workflow-editor")';
 const named=(scope,label,tag='input')=>'[...'+scope+'.querySelectorAll('+json(tag)+')].find(e=>e.closest("label")?.textContent.startsWith('+json(label)+'))';
 await type(named(editor,'Workflow name'),'Read local page');
 await select(editor+'.querySelector("select")',await c.evaluate('flowTarget.pageId'));await click(button('Add page scope',editor));
 await click(editor+'.querySelector("details>summary")');await select(editor+'.querySelector("details select")',await c.evaluate('flowTarget.pageId'));await click(button('Inspect page elements',editor));
 await until(editor+'.querySelector("dl").textContent.includes("Message")');check('editor-inspection-uses-real-native-accessibility-names',await c.evaluate(editor+'.querySelector("dl").textContent.includes("text input")'));
 await click(button('Add step',editor));await inspectLayout({c,p,root,runtime,check},'workflow-editor',editor);
 await click(button('Save workflow',editor));await until('flows.definitions().some(d=>d.title==="Read local page")');
 await c.evaluate('window.readFlow=flows.definitions().find(d=>d.title==="Read local page");flows.review(readFlow.id,{},[{id:readFlow.targetScope[0].id,profileId:"default",pageId:flowTarget.pageId}]).then(r=>{window.readReview=r;return flows.invoke(r.id)})');
 await until('owner.receipt(readReview.id)?.status==="succeeded"');await c.evaluate('flows.saveVerified(owner.receipt(readReview.id).runId)');
 check('native-editor-authored-steps-verified-reusable',await c.evaluate('!!flows.definitions().find(d=>d.id===readFlow.id).verification'));
 const ae='[...document.querySelectorAll(".nand-automation-editor")].find(e=>e.getBoundingClientRect().width>0)';
 const setting=(label,tag)=>'[...'+ae+'.querySelectorAll(".setting-item")].find(e=>e.querySelector(".setting-item-name")?.textContent==='+json(label)+').querySelector('+json(tag)+')';
 const ap='[...document.querySelectorAll(".nand-automation-page")].find(e=>e.getBoundingClientRect().width>0)';
 const createAutomation=async(workflow,name,schedule,message)=>{
  await c.evaluate(p+'.services.peek({owner:"automations",id:"ui"}).edit()');await until('!!'+ae);
  await select(setting('Action','select'),'browser-workflow');await until('!!'+ae+'.querySelector(".nand-automation-editor-main select")');
  await select(setting('Browser workflow','select'),workflow+':1');await until('!!'+ae+'.querySelector(".nand-automation-editor-main .setting-item:last-child select")');
  await type(setting('Name','input'),name);if(message)await type(setting('message','input'),message);
  const scope=await c.evaluate('flows.definitions().find(d=>d.id==='+json(workflow)+').targetScope[0].id');await select(setting(scope,'select'),await c.evaluate('flowTarget.pageId'));
  await select(setting('Schedule','select'),schedule);await until('!!'+ae+'.querySelector(".nand-automation-editor-main select")');
  if(schedule==='now') {
   await inspectLayout({c,p,root:ae,runtime,check},'automation-workflow-editor',ae);
   await delay(250); // Restoring CDP metrics also restores the shell sidebar; wait for its layout frame.
   const overflow=await c.evaluate('(()=>{const r='+ae+'.getBoundingClientRect();return [...'+ae+'.querySelectorAll("input:not([type=checkbox]),select,textarea")].filter(e=>{const c=e.getBoundingClientRect();return c.width&&getComputedStyle(e).visibility!=="hidden"&&getComputedStyle(e).opacity!=="0"&&(c.left<r.left-1||c.right>r.right+1)}).map(e=>({tag:e.tagName,type:e.type,control:e.getBoundingClientRect().toJSON(),editor:r.toJSON(),styles:[e,e.parentElement,e.parentElement.parentElement].map(n=>({tag:n.tagName,classes:n.className,box:n.getBoundingClientRect().toJSON(),width:getComputedStyle(n).width,maxWidth:getComputedStyle(n).maxWidth,minWidth:getComputedStyle(n).minWidth,flex:getComputedStyle(n).flex,display:getComputedStyle(n).display}))}))})()');
   check('workflow-page-select-stays-inside-automation-editor',overflow.length===0,overflow);
  }
  await runtime.shot('automation-'+schedule);await click(button('Save',ae));await until('!'+ae);
  await c.evaluate('window.autoService=app.workspace.getLeavesOfType("nand-workbench-view").flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.host?.service?.state?.runs).host.service;true');
  await until('autoService.definitions.some(d=>d.name==='+json(name)+')');return await c.evaluate('autoService.definitions.find(d=>d.name==='+json(name)+').id');
 };
 const scheduled=await createAutomation(await c.evaluate('readFlow.id'),'Scheduled local observation','now');
 await until('autoService.state.runs.some(r=>r.automationId==='+json(scheduled)+'&&r.status==="succeeded")');
 check('real-editor-and-scheduler-share-one-browser-run',await c.evaluate('(()=>{const r=autoService.state.runs.find(r=>r.automationId==='+json(scheduled)+');return r.trigger==="scheduled"&&flows.records().filter(f=>f.runId===r.id).length===1})()'));
 await click(button('Open workflow result',ap));await until('!!'+root);check('shared-history-opens-browser-step-artifact',await c.evaluate(root+'.textContent.includes("Read local page")'));
 await c.evaluate('flowGuest.executeJavaScript("resetWorkflow()")');
 const manual=await createAutomation(spec.id,'Manual form automation','manual','automation typed variable');await click(button('Run now',ap));
 await until('!!'+banner+'?.querySelector(".nand-browser-consequence")');
 await c.evaluate('window.manualRun=autoService.state.runs.find(r=>r.automationId==='+json(manual)+'&&r.status==="running");'+p+'.openWorkbench({feature:"automations"},window)');await until('!!'+ap);
 const runCard=ap+'.querySelector("[data-nand-run-id=\\""+manualRun.id+"\\"]")';await click(button('Stop',runCard));
 await until('manualRun.status==="cancelled"&&flows.records().find(r=>r.runId===manualRun.id).phase==="cancelled"');
 check('owner-ui-cancellation-keeps-browser-and-shared-receipt-consistent',await c.evaluate('flowGuest.executeJavaScript("workflowSubmissions")')===3);
 await c.evaluate('flowGuest.executeJavaScript("resetWorkflow()")');await c.evaluate('bc.activate(flowTarget)');
 await c.evaluate('autoService.run(autoService.definitions.find(d=>d.id==='+json(manual)+'),"scheduled",Date.now(),Date.now()).then(r=>{window.confirmRun=r;return true})');
 await until('!["pending","running"].includes(confirmRun.status)');
 check('scheduled-submission-stops-at-final-confirmation-without-clicking',await c.evaluate('confirmRun.status==="interrupted"&&flows.records().find(r=>r.runId===confirmRun.id).errorCode==="browser_workflow_confirmation_required"')&&await c.evaluate('flowGuest.executeJavaScript("workflowSubmissions")')===3);
 const secret='native-runtime-secret-value';const secretSpec=structuredClone(spec);secretSpec.id='native-secret-workflow';secretSpec.title='Secret local fill';secretSpec.variables[0].type='secret';secretSpec.consequenceClass='page-input';
 secretSpec.steps=[secretSpec.steps[0],{id:'read',target:'form',operation:'read',args:{element:message},precondition:[value(message,'{{message}}')],postcondition:[value(message,'{{message}}')]}];
 await c.evaluate('flowGuest.executeJavaScript("resetWorkflow()")');await c.evaluate('flows.save('+json(secretSpec)+')');
 await c.evaluate('flows.review("native-secret-workflow",{message:'+json(secret)+'},[{id:"form",profileId:"default",pageId:flowTarget.pageId}]).then(r=>{window.secretReview=r;return flows.invoke(r.id)})');
 await until('owner.receipt(secretReview.id)?.status==="succeeded"');
 check('native-secret-fill-succeeds-without-public-or-browser-evidence-leak',await c.evaluate('!JSON.stringify([owner.receipt(secretReview.id),flows.records(),autoService.state]).includes('+json(secret)+')')&&await c.evaluate('flowGuest.executeJavaScript('+json('document.querySelector("#message").value==='+json(secret))+')'));
 await c.evaluate('flowGuest.executeJavaScript('+json('resetWorkflow();const duplicate=document.createElement("textarea");duplicate.setAttribute("aria-label","Message");duplicate.id="duplicate";document.body.append(duplicate);true')+')');
 await c.evaluate('flows.review("native-workflow",{message:"do not fill ambiguous"},[{id:"form",profileId:"default",pageId:flowTarget.pageId}]).then(r=>{window.ambiguousReview=r;return flows.invoke(r.id)})');
 await until('owner.receipt(ambiguousReview.id)?.status==="failed"');
 check('native-duplicate-labels-cannot-be-disambiguated-by-display-ordinal',await c.evaluate('flows.records().find(r=>r.runId===owner.receipt(ambiguousReview.id).runId).errorCode==="browser_workflow_element"')&&await c.evaluate('flowGuest.executeJavaScript('+json('document.querySelector("#message").value===""&&document.querySelector("#duplicate").value===""')+')'));
 await c.evaluate('flowGuest.executeJavaScript('+json('document.querySelector("#duplicate").remove()')+')');
 const savedDocuments=(await fs.readdir(runtime.vault,{recursive:true})).filter(file=>/\.(md|json)$/.test(file));
 const savedTexts=await Promise.all(savedDocuments.map(file=>fs.readFile(path.join(runtime.vault,file),'utf8')));
 check('secret-is-absent-from-vault-markdown-and-json',savedTexts.every(text=>!text.includes(secret)),{documents:savedDocuments.length});
 await c.evaluate('flowGuest.executeJavaScript("resetWorkflow()")');
 await c.evaluate('autoService.run(autoService.definitions.find(d=>d.id==='+json(manual)+'))');await until('!!'+banner+'?.querySelector(".nand-browser-consequence")');
 const offId=await c.evaluate('autoService.state.runs.findLast(r=>r.automationId==='+json(manual)+'&&r.status==="running").id');
 await c.evaluate(p+'.setModuleEnabled("browser",false)');await until('autoService.state.runs.find(r=>r.id==='+json(offId)+').status==="interrupted"');
 await c.evaluate('autoService.run(autoService.definitions.find(d=>d.id==='+json(scheduled)+'),"scheduled",Date.now()+1,Date.now()+1).then(r=>{window.offRun=r;return true})');
 check('producer-disable-revokes-active-run-and-fails-new-trigger-with-definition-retained',await c.evaluate('offRun.status==="failed"&&offRun.errorCode==="workflowUnavailable"&&autoService.definitions.some(d=>d.id==='+json(scheduled)+')&&!'+p+'.services.peek({owner:"browser",id:"workflows"})'));
 await c.evaluate(p+'.setModuleEnabled("browser",true)');await bind();await c.evaluate('flows.initialize()');
 await c.evaluate('autoService.run(autoService.definitions.find(d=>d.id==='+json(scheduled)+'),"scheduled",Date.now()+2,Date.now()+2).then(r=>{window.missingRun=r;return true})');
 check('missing-selected-page-fails-without-opening-a-replacement-guest',await c.evaluate('missingRun.status==="failed"&&bc.list().length===0'));
 await openForm();await inspectLayout({c,p,root,runtime,check},'workflow-history',root);
 await c.evaluate(p+'.changeLanguage("zh")');await until(root+'.textContent.includes("浏览器流程")');check('workflow-language-refresh-retains-step-results',await c.evaluate('flows.records().filter(r=>r.phase==="succeeded").length===6'));
 await runtime.shot('workflow-history-zh');
 const before=await c.evaluate('flows.records().map(r=>[r.runId,r.phase])');await runtime.restart();c=runtime.connection;await bind();await c.evaluate(p+'.openWorkbench({feature:"browser",section:"workflows"},window)');await until('!!'+root);
 check('restart-recovers-records-without-opening-guests-or-replaying-actions',await c.evaluate('bc.list().length===0&&JSON.stringify(flows.records().map(r=>[r.runId,r.phase]))==='+json(json(before))));
 check('no-host-exceptions',errors.length===0,errors);
 await fs.writeFile(path.join(runtime.evidence,'workflows.json'),json({rows,errors,records:await c.evaluate('flows.records()'),bytes:{main:(await fs.stat('main.js')).size,styles:(await fs.stat('styles.css')).size}}));
 console.log(json({passed:rows.length,evidence:runtime.evidence}));
} catch(error) { if(runtime){await runtime.shot('workflow-failure').catch(()=>{});await fs.writeFile(path.join(runtime.evidence,'workflow-failure.json'),json({error:String(error),rows,errors,body:await c?.evaluate('document.body.innerText').catch(()=>''),records:await c?.evaluate('flows?.records()').catch(()=>[])}));}throw error; }
finally {await runtime?.stop();}
